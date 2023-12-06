import { A } from '@mobily/ts-belt';

import { createThunk } from '@suite-common/redux-utils';
import {
    accountsActions,
    DISCOVERY_MODULE_PREFIX,
    filterUnavailableNetworks,
    selectDeviceAccountsLengthPerNetwork,
    selectDiscoveryForDevice,
    updateDiscovery,
    createDiscovery,
    removeDiscovery,
    getAvailableCardanoDerivationsThunk,
    selectDeviceByState,
} from '@suite-common/wallet-core';
import { selectIsAccountAlreadyDiscovered } from '@suite-native/accounts';
import TrezorConnect from '@trezor/connect';
import { DiscoveryItem } from '@suite-common/wallet-types';
import { getDerivationType } from '@suite-common/wallet-utils';
import { Network } from '@suite-common/wallet-config';
import { DiscoveryStatus } from '@suite-common/wallet-constants';
import { supportedMainnetSymbols, supportedNetworkSymbols } from '@suite-native/config';
import { requestDeviceAccess } from '@suite-native/device-mutex';
import { analytics, EventType } from '@suite-native/analytics';

import { fetchBundleDescriptors } from './utils';

const DISCOVERY_BATCH_SIZE = 2;

// Note: This is for analytics purposes
let discoveryStartTime: number | null = null;

type DiscoveryDescriptorItem = DiscoveryItem & { descriptor: string };

const finishNetworkTypeDiscoveryThunk = createThunk(
    `${DISCOVERY_MODULE_PREFIX}/finishNetworkTypeDiscoveryThunk`,
    (_, { dispatch, getState }) => {
        const discovery = selectDiscoveryForDevice(getState());

        if (!discovery) {
            return;
        }

        const finishedNetworksCount = discovery.loaded + 1;
        dispatch(
            updateDiscovery({
                ...discovery,
                loaded: finishedNetworksCount,
            }),
        );

        if (finishedNetworksCount >= discovery.total) {
            dispatch(removeDiscovery(discovery.deviceState));

            // Discovery analytics duration tracking
            if (discoveryStartTime !== null) {
                const endTime = performance.now();
                const duration = endTime - discoveryStartTime;
                const accountsMap = selectDeviceAccountsLengthPerNetwork(getState());

                analytics.report({
                    type: EventType.CoinDiscovery,
                    payload: { ...accountsMap, loadDuration: duration },
                });
                discoveryStartTime = null;
            }
        }
    },
);

const discoverAccountsByDescriptorThunk = createThunk(
    `${DISCOVERY_MODULE_PREFIX}/discoverAccountsByDescriptorThunk`,
    async (
        {
            descriptorsBundle,
            deviceState,
        }: {
            descriptorsBundle: DiscoveryDescriptorItem[];
            deviceState: string;
        },
        { dispatch },
    ) => {
        let isFinalRound = false;

        if (A.isEmpty(descriptorsBundle)) {
            isFinalRound = true;
        }

        // eslint-disable-next-line no-restricted-syntax
        for (const bundleItem of descriptorsBundle) {
            // eslint-disable-next-line no-await-in-loop
            const { success, payload: accountInfo } = await TrezorConnect.getAccountInfo({
                coin: bundleItem.coin,
                descriptor: bundleItem.descriptor,
                useEmptyPassphrase: true,
                details: 'txs',
            });

            if (success) {
                if (accountInfo.empty) {
                    isFinalRound = true;
                    break;
                }

                dispatch(
                    accountsActions.createIndexLabeledAccount({
                        discoveryItem: bundleItem,
                        deviceState,
                        accountInfo,
                    }),
                );
            }
        }

        return isFinalRound;
    },
);

const discoverNetworkBatchThunk = createThunk(
    `${DISCOVERY_MODULE_PREFIX}/discoverNetworkBatchThunk`,
    async (
        {
            deviceState,
            round = 1,
            network,
        }: {
            deviceState: string;
            round?: number;
            network: Network;
        },
        { dispatch, getState },
    ) => {
        const discovery = selectDiscoveryForDevice(getState());

        if (!discovery || !deviceState) {
            return;
        }

        const accountType = network.accountType || 'normal';

        const lastDiscoveredAccountIndex = (round - 1) * DISCOVERY_BATCH_SIZE;

        // Skip Cardano legacy/ledger account types if device does not support it.
        const isIncompatibleCardanoType =
            network.networkType === 'cardano' &&
            (network.accountType === 'ledger' || network.accountType === 'legacy') &&
            !discovery.availableCardanoDerivations?.includes(network.accountType);

        if (isIncompatibleCardanoType) {
            dispatch(finishNetworkTypeDiscoveryThunk());
            return;
        }

        const chunkBundle: Array<DiscoveryItem> = [];

        A.makeWithIndex(DISCOVERY_BATCH_SIZE, index => {
            const accountPath = network.bip43Path.replace(
                'i',
                (lastDiscoveredAccountIndex + index).toString(),
            );

            const isAccountAlreadyDiscovered = selectIsAccountAlreadyDiscovered(getState(), {
                deviceState,
                networkSymbol: network.symbol,
                path: accountPath,
            });

            if (!isAccountAlreadyDiscovered) {
                chunkBundle.push({
                    path: accountPath,
                    coin: network.symbol,
                    index,
                    accountType,
                    networkType: network.networkType,
                    derivationType: getDerivationType(accountType),
                    suppressBackupWarning: true,
                });
            }
        });

        // All accounts of the batch were already discovered, skip it.
        if (A.isEmpty(chunkBundle)) {
            dispatch(
                discoverNetworkBatchThunk({
                    deviceState,
                    network,
                    round: round + 1,
                }),
            );
            return;
        }

        // Take exclusive access to the device and hold it until is the fetching of the descriptors done.
        const deviceAccessResponse = await requestDeviceAccess(fetchBundleDescriptors, chunkBundle);

        if (!deviceAccessResponse.success) {
            return;
        }

        const isFinished = await dispatch(
            discoverAccountsByDescriptorThunk({
                descriptorsBundle: deviceAccessResponse.payload,
                deviceState,
            }),
        ).unwrap();

        if (!isFinished) {
            dispatch(
                discoverNetworkBatchThunk({
                    deviceState,
                    network,
                    round: round + 1,
                }),
            );
        } else {
            dispatch(finishNetworkTypeDiscoveryThunk());
        }
    },
);

export const createDescriptorPreloadedDiscoveryThunk = createThunk(
    `${DISCOVERY_MODULE_PREFIX}/createDescriptorPreloadedDiscoveryThunk`,
    async (
        {
            deviceState,
            areTestnetsEnabled,
        }: {
            deviceState: string;
            areTestnetsEnabled: boolean;
        },
        { dispatch, getState },
    ) => {
        const device = selectDeviceByState(getState(), deviceState);

        if (!device) {
            return;
        }
        const networks = areTestnetsEnabled ? supportedNetworkSymbols : supportedMainnetSymbols;

        const deviceAccessResponse = await requestDeviceAccess(() =>
            dispatch(
                getAvailableCardanoDerivationsThunk({
                    deviceState,
                    device,
                    isUseEmptyPassphraseForced: true,
                }),
            ).unwrap(),
        );

        if (!deviceAccessResponse.success) return false;

        const discoveryNetworksTotalCount = filterUnavailableNetworks(networks, device).length;

        dispatch(
            createDiscovery({
                deviceState,
                authConfirm: false,
                index: 0,
                status: DiscoveryStatus.RUNNING,
                total: discoveryNetworksTotalCount,
                bundleSize: 0,
                loaded: 0,
                failed: [],
                availableCardanoDerivations: deviceAccessResponse.payload,
                networks,
            }),
        );
    },
);

export const startDescriptorPreloadedDiscoveryThunk = createThunk(
    `${DISCOVERY_MODULE_PREFIX}/startDescriptorPreloadedDiscoveryThunk`,
    async (
        { deviceState, areTestnetsEnabled }: { deviceState: string; areTestnetsEnabled: boolean },
        { dispatch, getState },
    ) => {
        const device = selectDeviceByState(getState(), deviceState);

        if (!device) {
            return;
        }

        // Start tracking duration for analytics purposes
        discoveryStartTime = performance.now();

        await dispatch(
            createDescriptorPreloadedDiscoveryThunk({
                deviceState,
                areTestnetsEnabled,
            }),
        );
        const discovery = selectDiscoveryForDevice(getState());

        if (!discovery) {
            return;
        }

        // Get only device supported networks.
        const networks = filterUnavailableNetworks(discovery.networks, device);

        // Start discovery for every network account type.
        networks.forEach(network => {
            dispatch(discoverNetworkBatchThunk({ deviceState, network }));
        });
    },
);
