import { Client } from '@web3mq/client';

// You can save the bestEndpointUrl locally to skip endpoint search next time, which will save time, and
export const bestEndpointUrl = await Client.init({
    connectUrl: '', //
    app_key: 'OVEEGLRxtqXcEIJN', // temporary authorization key obtained by applying, will be removed in future testnets and mainnet
});