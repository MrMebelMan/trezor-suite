import React from 'react';
import styled from 'styled-components';

const Wrapper = styled.div`
    position: fixed;
    z-index: 10000;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.3);
    backdrop-filter: blur(5px);
    display: flex;
    flex-direction: column;
    align-items: center;
    overflow: auto;
    > :first-child {
        margin-top: auto;
    }
    > :last-child {
        margin-bottom: auto;
    }
`;

export type BackdropProps = {
    onClick?: () => void;
    children: React.ReactNode;
    className?: string;
};

export const Backdrop = ({ onClick, children, className }: BackdropProps) => (
    <Wrapper onClick={onClick} className={className} data-test="@modal">
        {children}
    </Wrapper>
);
