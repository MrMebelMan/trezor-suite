import React, { useCallback, useState } from 'react';
import styled from 'styled-components';
import { WithInvityLayoutProps, InvityLayout, withSelectedAccountLoaded } from '@wallet-components';
import { Translation } from '@suite-components';
import { useInvityNavigation } from '@wallet-hooks/useInvityNavigation';
import { useEffectOnce } from 'react-use';
import { Loader } from '@trezor/components';
import invityAPI from '@suite-services/invityAPI';

const Wrapper = styled.div`
    display: flex;
    flex-direction: row;
`;

const Right = styled.div`
    width: 100%;
`;

const Header = styled.div`
    font-size: 24px;
    line-height: 24px;
    margin-bottom: 8px;
`;

const Description = styled.div`
    font-size: 14px;
    line-height: 24px;
    margin-bottom: 8px;
    color: ${props => props.theme.TYPE_LIGHT_GREY};
`;

const Divider = styled.div`
    margin-top: 25px;
    margin-bottom: 15px;
    height: 1px;
    width: 100%;
    border: 1px solid ${props => props.theme.BG_SECONDARY};
`;

const Footer = styled.div`
    display: flex;
    flex-direction: column;
    flex-wrap: nowrap;
    justify-content: center;
    align-items: center;
    align-content: stretch;
`;

const AlreadyHaveAccount = styled.span`
    font-size: 14px;
    line-height: 24px;
    color: ${props => props.theme.TYPE_LIGHT_GREY};
`;

const LogIn = styled(AlreadyHaveAccount)`
    text-decoration: underline;
    cursor: pointer;
`;

const StyledLoader = styled(Loader)<{ isHidden: boolean }>`
    height: 150px;
    width: 100%;
    display: ${props => (props.isHidden ? 'none' : 'flex')};
`;

const StyledForm = styled.form<{ isHidden: boolean }>`
    display: ${props => (props.isHidden ? 'none' : 'initial')};
`;

const KratosError = styled.div`
    color: red;
`;

type CoinmarketSavingsLoginRegistrationProps = WithInvityLayoutProps;

interface OryCredential extends Credential {
    rawId?: ArrayBuffer;
    response?: AuthenticatorAttestationResponse;
}

const CoinmarketSavingsRegistration = ({
    selectedAccount,
}: CoinmarketSavingsLoginRegistrationProps) => {
    const { navigateToInvityLogin } = useInvityNavigation(selectedAccount.account);

    const handleLogInClick = useCallback(() => navigateToInvityLogin(), [navigateToInvityLogin]);
    const [formAction, setFormAction] = useState('');
    const [formMethod, setFormMethod] = useState('');
    const [email, setEmail] = useState('');
    const [csrfToken, setCsrfToken] = useState('');
    const [registerOnClick, setRegisterOnClick] = useState('{}');
    const [error, setError] = useState('');
    const [webauthnScriptSrc, setWebauthnScriptSrc] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const fetchFlowData = async () => {
        const flowUrl = `${invityAPI.getAuthServerUrl()}/self-service/registration/browser`;
        setIsLoading(true);
        const response = await fetch(flowUrl, {
            headers: {
                Accept: 'application/json',
            },
            credentials: 'include',
        });
        const json = await response.json();
        setIsLoading(false);
        if (json.error) {
            setError(json.error.message); // "you are already logged in"
            return;
        }
        setFormAction(json.ui.action);
        setFormMethod(json.ui.method);
        setCsrfToken(json.ui.nodes[1].attributes.value);
        setWebauthnScriptSrc(json.ui.nodes[5].attributes.src);
        setRegisterOnClick(json.ui.nodes[4].attributes.onclick);
    };

    useEffectOnce(() => {
        fetchFlowData();
    });

    const submitForm = async (webauthnRegisterData: string) => {
        setIsLoading(true);
        const response = await fetch(formAction, {
            method: formMethod,
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            credentials: 'include',
            body: `csrf_token=${encodeURIComponent(
                csrfToken,
            )}&method=webauthn&identifier=${encodeURIComponent(email)}&${encodeURIComponent(
                'traits.email',
            )}=${encodeURIComponent(email)}&webauthn_register=${encodeURIComponent(
                webauthnRegisterData,
            )}&webauthn_register_displayname=&webauthn_register_trigger`,
        });
        const json = await response.json();
        setIsLoading(false);
        if (json.error) {
            setError(json.error.message);
        } else if (json.identity?.state === 'active') {
            setError('REGISTERED!');
        } else if (json.ui.messages) {
            setError(json.ui.messages[0].text);
        }
    };

    const oryWebAuthnBufferDecode = (value: BufferSource) =>
        Uint8Array.from(atob(value.toString()), c => c.charCodeAt(0));

    const oryWebAuthnBufferEncode = (value: ArrayBuffer) =>
        btoa(String.fromCharCode(...new Uint8Array(value)))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '');

    const oryWebAuthnRegistration = async (opt: CredentialCreationOptions) => {
        if (!window.PublicKeyCredential) {
            setError('This browser does not support WebAuthn!');
        }

        if (!opt.publicKey?.user.id) {
            setError('no user id');
            return;
        }

        let webauthnRegisterData = '';
        try {
            if (opt.publicKey.excludeCredentials) {
                opt.publicKey.excludeCredentials = opt.publicKey.excludeCredentials.map(value => ({
                    ...value,
                    id: oryWebAuthnBufferDecode(value.id),
                }));
            }
            const credential: OryCredential | null = await navigator.credentials.create(opt);
            if (!credential?.rawId || !credential?.response) {
                setError('Incomplete authentication credentials');
                return;
            }
            webauthnRegisterData = JSON.stringify({
                id: credential.id,
                rawId: oryWebAuthnBufferEncode(credential.rawId),
                type: credential.type,
                response: {
                    attestationObject: oryWebAuthnBufferEncode(
                        credential.response.attestationObject,
                    ),
                    clientDataJSON: oryWebAuthnBufferEncode(credential.response.clientDataJSON),
                },
            });
        } catch (err) {
            setError(err.toString());
        }
        await submitForm(webauthnRegisterData);
    };

    const webauthnTrigger = () => {
        const opts: any = JSON.parse(
            registerOnClick.replace('window.__oryWebAuthnRegistration(', '').replace(')', ''),
        );
        opts.publicKey.user.id = Buffer.from(opts.publicKey.user.id, 'base64');
        opts.publicKey.challenge = Buffer.from(opts.publicKey.challenge, 'base64');

        oryWebAuthnRegistration(opts);
    };

    return (
        <InvityLayout selectedAccount={selectedAccount} showStepsGuide>
            <Wrapper>
                <Right>
                    <Header>
                        <Translation id="TR_INVITY_REGISTRATION_HEADER" />
                    </Header>
                    <Description>
                        <Translation id="TR_INVITY_REGISTRATION_DESCRIPTION" />
                    </Description>
                    <StyledLoader isHidden={!isLoading} />
                    <StyledForm id="form" action="" method="" isHidden={isLoading}>
                        <input
                            id="email"
                            name="identifier"
                            type="email"
                            autoComplete="email"
                            placeholder="Email"
                            required
                            className="email"
                            onChange={e => setEmail(e.target.value)}
                        />
                        <input id="csrf_token" name="csrf_token" type="hidden" />
                        <script
                            async
                            src={webauthnScriptSrc}
                            id="webauthn_script"
                            type="text/javascript"
                            referrerPolicy="no-referrer"
                            crossOrigin="anonymous"
                        />
                        <button
                            id="webauthn_register_trigger"
                            name="webauthn_register_trigger"
                            type="button"
                            value=""
                            onClick={webauthnTrigger}
                        >
                            Sign up using security key
                        </button>
                        <KratosError>{error}</KratosError>
                    </StyledForm>
                    <Divider />
                    <Footer>
                        <AlreadyHaveAccount>
                            <Translation
                                id="TR_INVITY_REGISTRATION_FOOTER_ALREADY_HAVE_AN_ACCOUNT"
                                values={{
                                    login: (
                                        <LogIn onClick={handleLogInClick}>
                                            <Translation id="TR_INVITY_REGISTRATION_FOOTER_ALREADY_HAVE_AN_ACCOUNT_LOGIN" />
                                        </LogIn>
                                    ),
                                }}
                            />
                        </AlreadyHaveAccount>
                    </Footer>
                </Right>
            </Wrapper>
        </InvityLayout>
    );
};

export default withSelectedAccountLoaded(CoinmarketSavingsRegistration, {
    title: 'TR_NAV_INVITY',
});
