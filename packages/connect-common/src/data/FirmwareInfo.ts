import { getInfo } from '@trezor/rollout';

// todo: duplicated with trezor-connect
type Release = {
    required: true,
    version: number[],
    min_bridge_version: number[],
    min_firmware_version: number[],
    bootloader_version: number[],
    min_bootloader_version: number[],
    url: string,
    fingerprint: string,
    changelog: string,
    channel?: string,
};

// todo: duplicated with trezor-connect
export type FirmwareRelease = {
    changelog: Release[] | null,
    release: Release,
    isLatest: boolean | null,
    isRequired: boolean | null,
    isNewer: boolean | null,
};

// todo: local features only for this file
// todo: remove later. protobuf.d.ts is not yet part of monorepo
type Features = {
    vendor: string,
    major_version: number,
    minor_version: number,
    patch_version: number,
    bootloader_mode: boolean | null,
    device_id: string | null,
    pin_protection: boolean | null,
    passphrase_protection: boolean | null,
    language: string | null,
    label: string | null,
    initialized: boolean | null,
    revision: string | null,
    bootloader_hash: string | null,
    imported: boolean | null,
    unlocked: boolean | null,
    _passphrase_cached?: boolean,
    firmware_present: boolean | null,
    needs_backup: boolean | null,
    flags: number | null,
    model: string,
    fw_major: number | null,
    fw_minor: number | null,
    fw_patch: number | null,
    fw_vendor: string | null,
    unfinished_backup: boolean | null,
    no_backup: boolean | null,
    recovery_mode: boolean | null,
    sd_card_present: boolean | null,
    sd_protection: boolean | null,
    wipe_code_protection: boolean | null,
    session_id: string | null,
    passphrase_always_on_device: boolean | null,
    auto_lock_delay_ms: number | null,
    display_rotation: number | null,
    experimental_features: boolean | null,
};

const releases: { [key: number]: FirmwareRelease[] } = {};
releases[1] = [];
releases[2] = [];

// strip "data" directory from download url (default: data.trezor.io)
// it's hard coded in "releases.json" ("mytrezor" dir structure)
const cleanUrl = (url?: string) => {
    if (typeof url !== 'string') return;
    if (url.indexOf('data/') === 0) return url.substring(5);
    return url;
};

export const parseFirmware = (json: any, model: number) => {
    Object.keys(json).forEach(key => {
        const release = json[key];
        releases[model].push({
            ...release,
            url: cleanUrl(release.url),
            url_bitcoinonly: cleanUrl(release.url_bitcoinonly),
        });
    });
};

export const getFirmwareStatus = (features: Features) => {
    // indication that firmware is not installed at all. This information is set to false in bl mode. Otherwise it is null.
    if (features.firmware_present === false) {
        return 'none';
    }
    // for t1 in bootloader, what device reports as firmware version is in fact bootloader version, so we can
    // not safely tell firmware version
    if (features.major_version === 1 && features.bootloader_mode) {
        return 'unknown';
    }

    // todo: there is releases type in @trezor/rollout which is not compatible with releases here
    // @trezor/rollout should be removed/merged into connect-* packages, so I am skipping type-check for now
    // @ts-ignore
    const info = getInfo({ features, releases: releases[features.major_version] });

    // should not happen, possibly if releases list contains inconsistent data or so
    if (!info) return 'unknown';

    if (info.isRequired) return 'required';

    if (info.isNewer) return 'outdated';

    return 'valid';
};

// todo: maybe move rollouts code directly here?
export const getRelease = (features: Features) =>
    // for t1 in bootloader, what device reports as firmware version is in fact bootloader version, so we can
    // not safely tell firmware version
    // @ts-ignore
    getInfo({ features, releases: releases[features.major_version] });

export const getReleases = (model: number) => releases[model];
