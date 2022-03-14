import { css } from 'styled-components';
import { variables } from '../config';

export type ScalingValues = {
    sm: string;
    md: string;
    lg: string;
    xl: string;
};

export const Scaling = (property: string, { sm, md, lg, xl }: ScalingValues) => css`
    ${property}: ${xl};

    @media only screen and (max-width: ${variables.SCREEN_SIZE.SM}) {
        ${property}: ${sm};
    }

    @media only screen and (min-width: ${variables.SCREEN_SIZE.SM}) and (max-width: ${variables
            .SCREEN_SIZE.MD}) {
        ${property}: ${md};
    }

    @media only screen and (min-width: ${variables.SCREEN_SIZE.MD}) and (max-width: ${variables
            .SCREEN_SIZE.LG}) {
        ${property}: ${lg};
    }
`;
