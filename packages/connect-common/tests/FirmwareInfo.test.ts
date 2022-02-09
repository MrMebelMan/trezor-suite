import { FirmwareInfo } from '../src';
import * as releases2 from '../src/files/firmware/2/releases.json';

describe('FirmwareInfo', () => {
    beforeEach(() => {
        FirmwareInfo.parseFirmware(releases2, 2);
    });

    test('getReleases', () => {
        expect(FirmwareInfo.getReleases(2)[0]).toMatchObject({
            ...releases2[0],
            url: expect.any(String),
            url_bitcoinonly: expect.any(String),
        });
    });

    test('getFirmwareStatus', () => {
        expect(
            // @ts-ignore
            FirmwareInfo.getFirmwareStatus({
                firmware_present: false,
            }),
        ).toEqual('none');

        // @ts-ignore
        expect(
            // @ts-ignore
            FirmwareInfo.getFirmwareStatus({
                major_version: 1,
                bootloader_mode: true,
            }),
        ).toEqual('unknown');
    });
});
