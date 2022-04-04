/* eslint-disable no-underscore-dangle */
(function () {
    if (!window) {
        return;
    }

    if (!window.PublicKeyCredential) {
        console.error('This browser does not support WebAuthn!');
    }

    if (window.__oryWebAuthnInitialized) {
        return;
    }

    function __oryWebAuthnBufferDecode(value) {
        return Uint8Array.from(atob(value), c => c.charCodeAt(0));
    }

    function __oryWebAuthnBufferEncode(value) {
        return btoa(String.fromCharCode.apply(null, new Uint8Array(value)))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '');
    }

    function __oryWebAuthnLogin(
        opt,
        resultQuerySelector = '*[name="webauthn_login"]',
        triggerQuerySelector = '*[name="webauthn_login_trigger"]',
    ) {
        if (!window.PublicKeyCredential) {
            return showMessage('error', 'Error: This browser does not support WebAuthn!'); // showMessage is a function declared in flow.js
        }

        opt.publicKey.challenge = __oryWebAuthnBufferDecode(opt.publicKey.challenge);
        opt.publicKey.allowCredentials = opt.publicKey.allowCredentials.map(value => ({
            ...value,
            id: __oryWebAuthnBufferDecode(value.id),
        }));

        navigator.credentials
            .get(opt)
            .then(credential => {
                document.querySelector(resultQuerySelector).value = JSON.stringify({
                    id: credential.id,
                    rawId: __oryWebAuthnBufferEncode(credential.rawId),
                    type: credential.type,
                    response: {
                        authenticatorData: __oryWebAuthnBufferEncode(
                            credential.response.authenticatorData,
                        ),
                        clientDataJSON: __oryWebAuthnBufferEncode(
                            credential.response.clientDataJSON,
                        ),
                        signature: __oryWebAuthnBufferEncode(credential.response.signature),
                        userHandle: __oryWebAuthnBufferEncode(credential.response.userHandle),
                    },
                });

                HTMLFormElement.prototype.submit.call(
                    document.querySelector(triggerQuerySelector).closest('form'),
                );
            })
            .catch(err => {
                showMessage('error', err); // showMessage is a function declared in flow.js
            });
    }

    function __oryWebAuthnRegistration(
        opt,
        resultQuerySelector = '*[name="webauthn_register"]',
        triggerQuerySelector = '*[name="webauthn_register_trigger"]',
    ) {
        if (!window.PublicKeyCredential) {
            return showMessage('error', 'Error: This browser does not support WebAuthn!'); // showMessage is a function declared in flow.js
        }

        opt.publicKey.user.id = __oryWebAuthnBufferDecode(opt.publicKey.user.id);
        opt.publicKey.challenge = __oryWebAuthnBufferDecode(opt.publicKey.challenge);

        if (opt.publicKey.excludeCredentials) {
            opt.publicKey.excludeCredentials = opt.publicKey.excludeCredentials.map(value => ({
                ...value,
                id: __oryWebAuthnBufferDecode(value.id),
            }));
        }

        navigator.credentials
            .create(opt)
            .then(credential => {
                document.querySelector(resultQuerySelector).value = JSON.stringify({
                    id: credential.id,
                    rawId: __oryWebAuthnBufferEncode(credential.rawId),
                    type: credential.type,
                    response: {
                        attestationObject: __oryWebAuthnBufferEncode(
                            credential.response.attestationObject,
                        ),
                        clientDataJSON: __oryWebAuthnBufferEncode(
                            credential.response.clientDataJSON,
                        ),
                    },
                });

                HTMLFormElement.prototype.submit.call(
                    document.querySelector(triggerQuerySelector).closest('form'),
                );
            })
            .catch(err => {
                console.error(err);
                showMessage('error', err); // showMessage is a function declared in flow.js
            });
    }

    window.__oryWebAuthnLogin = __oryWebAuthnLogin;
    window.__oryWebAuthnRegistration = __oryWebAuthnRegistration;
    window.__oryWebAuthnInitialized = true;
})();
