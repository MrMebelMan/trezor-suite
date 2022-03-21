import { getRequest, postRequest } from './http';

const url = 'https://submarine.corp.sldev.cz/api/v0/invoice_details/bitcoin';
export const getInvoiceDetails = (invoice: string) => {
    // TODO: make some checks, validations for invoice...
    const response = getRequest(`${url}/${invoice}`);

    console.log('response', response);
    return response;
};

export const requestSubmarineSwap = async (invoice: string, refund: string, network = 'bitcoin') => {
    console.log('requestSubmarineSwap in lightning package.');

    // POST
    // https://submarine.corp.sldev.cz/api/v0/swaps/
    // Payload
    // {
    //     invoice: "lnbc2558620n1p3zvt8rpp56mtlcd6vafrurx9x2z256zzmcvxhex9f4mlqmfvm0tsrx8a9wd0qdpa2pskjepqw3hjq3r0deshgefqw3hjqjzjgcs8vv3qyq5y7unyv4ezqj2y8gszjxqy9ghlcqpjsp5a2yl4tr0jv2wgmle32vg5t06yv9yz34c00fqawde6ef47k6vspyqrzjq0dtsllcvdvc9q2ug4n7kk90fruegng3c447ky4ercgyn2h2qmscwztmeyqq58cqqyqqqgegqqqqphqq9q9qyyssqq63zqsvu85fcmqcp9l9kucu2pesnx9g2cw6z3js4f6nlqlxwqh3x77wnza5508l76hhnvx6487q4j27947g73evevpaqec9vqshfpugp5qyprc"
    //     network: "bitcoin"
    //     refund: "bc1qd805ukudvzu6l9fl3w8qet68mqr5fszyq6mgwc"
    // }

    const payload = {
        invoice,
        network,
        refund,
    }

    console.log('payload', payload);

    const respose = await postRequest('https://submarine.corp.sldev.cz/api/v0/swaps/', payload);
    console.log('response in lightning submarine swaps');
    return respose;
}
