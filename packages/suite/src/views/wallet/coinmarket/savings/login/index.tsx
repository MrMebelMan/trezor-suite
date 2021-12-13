import React, { useContext, useEffect } from 'react';
import { useSelector } from '@suite-hooks';
import { CoinmarketLayout, WalletLayout } from '@wallet-components';
import CoinmarketAuthentication, {
    CoinmarketAuthenticationContext,
} from '@wallet-components/CoinmarketAuthentication';
import { useCoinmarketNavigation } from '@wallet-hooks/useCoinmarketNavigation';
import type { AppState } from '@suite-types';
import invityAPI from '@suite-services/invityAPI';
import { Button } from '@trezor/components';

interface CoinmarketSavingsLoginLoadedProps {
    selectedAccount: Extract<AppState['wallet']['selectedAccount'], { status: 'loaded' }>;
}

const CoinmarketSavingsLoginLoaded = ({ selectedAccount }: CoinmarketSavingsLoginLoadedProps) => {
    const { whoAmI, fetching } = useContext(CoinmarketAuthenticationContext);
    const { navigateToSavings, navigateToSavingsRegistration } = useCoinmarketNavigation(
        selectedAccount.account,
    );

    useEffect(() => {
        if (!fetching && whoAmI?.verified) {
            navigateToSavings();
        }
    }, [fetching, navigateToSavings, whoAmI?.verified]);
    return (
        <CoinmarketLayout>
            {whoAmI && !whoAmI.verified && <p>Verify your email to continue: {whoAmI?.email}</p>}
            <Button onClick={() => navigateToSavingsRegistration()}>
                Navigate to Registration
            </Button>
            <iframe
                title="login"
                frameBorder="0"
                src={invityAPI.getLoginPageSrc()}
                sandbox="allow-scripts allow-forms allow-same-origin"
            />
        </CoinmarketLayout>
    );
};

const CoinmarketSavingsLogin = () => {
    const props = useSelector(state => ({
        selectedAccount: state.wallet.selectedAccount,
    }));

    const { selectedAccount } = props;
    if (selectedAccount.status !== 'loaded') {
        return <WalletLayout title="TR_NAV_SAVINGS" account={selectedAccount} />;
    }
    return (
        <CoinmarketAuthentication checkWhoAmImmediately={false}>
            <CoinmarketSavingsLoginLoaded selectedAccount={selectedAccount} />
        </CoinmarketAuthentication>
    );
};

export default CoinmarketSavingsLogin;
