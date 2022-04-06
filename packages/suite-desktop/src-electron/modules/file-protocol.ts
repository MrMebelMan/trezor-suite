/**
 * Helps pointing to the right folder to load
 */
import path from 'path';
import { session } from 'electron';

import { PROTOCOL } from '../libs/constants';
import { Module } from './index';

const init: Module = ({ mainWindow, src }) => {
    // Point to the right directory for file protocol requests
    session.defaultSession.protocol.interceptFileProtocol(PROTOCOL, (request, callback) => {
        console.log(`interceptFileProtocol (${PROTOCOL})`);
        console.log(request);
        let url = request.url.substr(PROTOCOL.length + 1);
        url = path.join(__dirname, '..', '..', 'build', url);
        callback(url);
    });

    session.defaultSession.protocol.interceptFileProtocol('file', (request, callback) => {
        console.log('interceptFileProtocol (file)');
        console.log(request);
        callback({ url: request.url });
    });

    session.defaultSession.protocol.interceptBufferProtocol('http', (request, callback) => {
        console.log('interceptBufferProtocol');
        console.log(request);
        callback({ url: request.url });
    });

    session.defaultSession.protocol.interceptHttpProtocol('https', (request, callback) => {
        console.log('interceptHttpProtocol (HTTPS)');
        console.log(request);
        callback({ url: request.url });
    });

    session.defaultSession.protocol.interceptHttpProtocol('http', (request, callback) => {
        console.log('interceptHttpProtocol (HTTP)');
        console.log(request);
        callback({ url: request.url });
    });

    // Refresh if it failed to load
    mainWindow.webContents.on('did-fail-load', () => {
        mainWindow.loadURL(src);
    });
};

export default init;
