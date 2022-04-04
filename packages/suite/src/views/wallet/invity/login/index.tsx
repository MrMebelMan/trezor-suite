import React, { FormEvent, useState } from 'react';
import styled from 'styled-components';
import { InvityLayout, withSelectedAccountLoaded } from '@wallet-components';
import type { InvityLayoutProps } from '@wallet-components/InvityLayout';
import { Translation } from '@suite-components';
import { Link, LinkProps, Loader } from '@trezor/components';
import { isDesktop } from '@suite-utils/env';
import { getRoute } from '@suite-utils/router';
import { SUITE_URL } from '@suite-constants/urls';
import { useInvityLogin } from '@wallet-hooks/useInvityLogin';
import { useEffectOnce } from 'react-use';

const Wrapper = styled.div`
    display: flex;
    flex-direction: row;
    flex-wrap: nowrap;
    justify-content: flex-start;
    align-items: stretch;
    align-content: stretch;
`;

const Left = styled.div`
    width: 221px;
`;

const Right = styled.div`
    width: calc(100% - 221px);
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
    color: ${props => props.theme.TYPE_LIGHT_GREY};
`;

const ForgotPasswordLink = styled(Link)`
    font-size: 14px;
    line-height: 24px;
    text-decoration: underline;
`;

const NoAccount = styled.span`
    font-size: 14px;
    line-height: 24px;
`;

const CreateAnAccount = styled(Link)`
    font-size: 14px;
    line-height: 24px;
    text-decoration: underline;
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

const KratosInfo = styled.div`
    color: green;
`;

interface OryCredential extends Credential {
    rawId?: ArrayBuffer;
    response?: AuthenticatorAssertionResponse;
}

const CoinmarketSavingsLogin = (props: InvityLayoutProps) => {
    const { handleCreateAnAccountClick, handleForgotPasswordClick } = useInvityLogin(props);
    // NOTE: For Suite Desktop it's necessary to navigate user to Suite Web, so the user can recover password there.
    // The known reason so far is that the authorization server configuration differs for Suite Desktop and Suite Web.
    // TODO: Figure out how to resolve the recovery process flow issue in Suite Desktop.
    const forgotPasswordLinkProps: LinkProps = {
        href: isDesktop()
            ? `${SUITE_URL}/web${getRoute('wallet-invity-recovery', {
                  symbol: props.selectedAccount.account.symbol,
                  accountIndex: props.selectedAccount.account.index,
                  accountType: props.selectedAccount.account.accountType,
              })}`
            : undefined,
        onClick: !isDesktop() ? handleForgotPasswordClick : undefined,
        variant: 'nostyle',
    };
    const [isLoading, setIsLoading] = useState(false);
    const [formAction, setFormAction] = useState('');
    const [formMethod, setFormMethod] = useState('');
    const [email, setEmail] = useState('');
    const [csrfToken, setCsrfToken] = useState('');
    const [error, setError] = useState('');
    const [info, setInfo] = useState('');
    const [loginOnClick, setLoginOnClick] = useState('{}');

    const initializeFlow = async () => {
        setIsLoading(true);
        const flowUrl = 'http://localhost:4633/self-service/login/browser';
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
        setCsrfToken(json.ui.nodes[0].attributes.value);
    };

    useEffectOnce(() => {
        initializeFlow();
    });

    const fetchFlowData = async (url: string, method: string, webauthnLoginData = '') => {
        setError('');
        setInfo('');
        let options = {};
        if (method === 'POST') {
            options = {
                method,
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                credentials: 'include',
                body: `csrf_token=${encodeURIComponent(
                    csrfToken,
                )}&method=webauthn&identifier=${encodeURIComponent(email)}${
                    webauthnLoginData ? `&webauthn_login=${webauthnLoginData}` : ''
                }`,
            };
        } else {
            options = {
                method,
                headers: {
                    Accept: 'application/json',
                },
                credentials: 'include',
            };
        }
        setIsLoading(true);
        const response = await fetch(url, options);
        const json = await response.json();
        setIsLoading(false);
        if (json.redirect_browser_to) {
            // Correct email entered - request additional flow data to initialize webauthn
            const flowId = json.redirect_browser_to.split('=')[1];
            const flowUrl = `http://localhost:4633/self-service/login/flows?id=${flowId}`;
            await fetchFlowData(flowUrl, 'GET');
        } else if (json.error) {
            setError(json.error.message);
        } else if (json.ui) {
            if (json.ui.messages) {
                if (json.ui.messages.type === 'error') {
                    setError(json.ui.messages[0].text);
                } else {
                    setInfo(json.ui.messages[0].text);
                }
            }
            if (json.ui.nodes[3].attributes.name === 'webauthn_login_trigger') {
                setFormAction(json.ui.action);
                setLoginOnClick(json.ui.nodes[3].attributes.onclick);
            }
        } else if (json.session?.active) {
            setError('');
            setInfo('LOGGED IN!');
        }
    };

    const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        await fetchFlowData(formAction, formMethod);
    };

    // TODO: move oryWebAuthn* stuff to a separate script
    const oryWebAuthnBufferDecode = (value: BufferSource) =>
        Uint8Array.from(atob(value.toString()), c => c.charCodeAt(0));

    const oryWebAuthnBufferEncode = (value: ArrayBuffer) =>
        btoa(String.fromCharCode(...new Uint8Array(value)))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '');

    const oryWebAuthnLogin = async (opt: CredentialRequestOptions) => {
        if (!window.PublicKeyCredential) {
            setError('This browser does not support WebAuthn!');
            return;
        }

        if (!opt.publicKey || !opt.publicKey.allowCredentials) {
            setError('Incomplete credentials');
            return;
        }

        opt.publicKey.challenge = oryWebAuthnBufferDecode(opt.publicKey.challenge);
        opt.publicKey.allowCredentials = opt.publicKey.allowCredentials.map(value => ({
            ...value,
            id: oryWebAuthnBufferDecode(value.id),
        }));

        const credential: OryCredential | null = await navigator.credentials.get(opt);
        if (!credential?.rawId || !credential?.response) {
            setError('Incomplete authentication credentials');
            return;
        }
        let webauthnLoginData = '';
        try {
            webauthnLoginData = JSON.stringify({
                id: credential.id,
                rawId: oryWebAuthnBufferEncode(credential.rawId),
                type: credential.type,
                response: {
                    authenticatorData: oryWebAuthnBufferEncode(
                        credential.response.authenticatorData,
                    ),
                    clientDataJSON: oryWebAuthnBufferEncode(credential.response.clientDataJSON),
                    signature: oryWebAuthnBufferEncode(credential.response.signature),
                    userHandle: credential.response.userHandle
                        ? oryWebAuthnBufferEncode(credential.response.userHandle)
                        : '',
                },
            });
        } catch (err) {
            setError(err.toString());
        }
        await fetchFlowData(formAction, 'POST', webauthnLoginData);
    };

    const webauthnTrigger = () => {
        const opts: CredentialRequestOptions = JSON.parse(
            loginOnClick.replace('window.__oryWebAuthnLogin(', '').replace(')', ''),
        );
        oryWebAuthnLogin(opts);
    };

    return (
        <InvityLayout selectedAccount={props.selectedAccount}>
            <Wrapper>
                <Left />
                <Right>
                    <Header>
                        <Translation id="TR_INVITY_LOGIN_HEADER" />
                    </Header>
                    <Description>
                        <Translation id="TR_INVITY_LOGIN_DESCRIPTION" />
                    </Description>
                    <StyledLoader isHidden={!isLoading} />
                    <StyledForm
                        id="form"
                        action=""
                        method=""
                        onSubmit={onSubmit}
                        isHidden={isLoading}
                    >
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
                        <button id="submit" name="method" type="submit" value="webauthn">
                            Log in
                        </button>
                        <button
                            id="webauthn_login_trigger"
                            name="webauthn_login_trigger"
                            type="button"
                            value=""
                            onClick={webauthnTrigger}
                        >
                            Use security key
                        </button>
                        <KratosError>{error}</KratosError>
                        <KratosInfo>{info}</KratosInfo>
                    </StyledForm>
                    <Divider />
                    <Footer>
                        <ForgotPasswordLink {...forgotPasswordLinkProps}>
                            <Translation id="TR_INVITY_LOGIN_FORGOT_PASSWORD" />
                        </ForgotPasswordLink>
                        <NoAccount>
                            <Translation
                                id="TR_INVITY_LOGIN_NO_ACCOUNT"
                                values={{
                                    createAnAccount: (
                                        <CreateAnAccount
                                            variant="nostyle"
                                            onClick={handleCreateAnAccountClick}
                                        >
                                            <Translation id="TR_INVITY_LOGIN_NO_ACCOUNT_CREATE_AN_ACCOUNT" />
                                        </CreateAnAccount>
                                    ),
                                }}
                            />
                        </NoAccount>
                    </Footer>
                </Right>
            </Wrapper>
        </InvityLayout>
    );
};

export default withSelectedAccountLoaded(CoinmarketSavingsLogin, {
    title: 'TR_NAV_INVITY',
    redirectUnauthorizedUserToLogin: false,
});
