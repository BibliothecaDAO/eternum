import { useMemo, useState } from "react";
import { Client, WalletType } from "@web3mq/client";

export const useLogin = () => {
    const [_didValue, setDidValue] = useState<string>('');
    const password = '123456';
    const didType: WalletType = 'argentX' // or 'starknet';

    const [userExist, setUserExist] = useState<boolean>(false);

    const [loggedIn, setLoggedIn] = useState<boolean>(false);

    const [initUpdate, setInitUpdate] = useState<boolean>(false);

    const [loading, setLoading] = useState<boolean>(false);

    const connect = async () => {
        const { address: didValue } = await Client.register.getAccount(didType);
        setDidValue(didValue);

        console.log(didValue)

        const { userid, userExist } = await Client.register.getUserInfo({
            did_value: didValue,
            did_type: 'starknet',
        });
        localStorage.setItem("USER_ID", userid)

        console.log(userid, userExist)

        setUserExist(userExist)

        return { userExist, didValue }
    }

    // 2. create main key pairs
    const createKeyPairs = async (didValue: string) => {
        const { publicKey: localMainPublicKey, secretKey: localMainPrivateKey } = await Client.register.getMainKeypair({
            password,
            did_value: didValue,
            did_type: didType,
        });

        localStorage.setItem("MAIN_PRIVATE_KEY", localMainPrivateKey)
        localStorage.setItem("MAIN_PUBLIC_KEY", localMainPublicKey)
    }

    const getStorageValue = (key: string) => {
        return localStorage.getItem(key) || '';
    }

    const register = async (didValue: string) => {
        const { signContent } = await Client.register.getRegisterSignContent({
            userid: getStorageValue("USER_ID"),
            mainPublicKey: getStorageValue("MAIN_PUBLIC_KEY"),
            didType,
            didValue,
        });

        const { sign: signature, publicKey: did_pubkey = "" } =
            await Client.register.sign(signContent, didValue, didType);

        const params = {
            userid: getStorageValue("USER_ID"),
            didValue,
            mainPublicKey: getStorageValue("MAIN_PUBLIC_KEY"),
            did_pubkey,
            didType,
            nickname: "",
            avatar_url: `https://cdn.stamp.fyi/avatar/${didValue}?s=300`,
            signature,
        };

        await Client.register.register(params);
    }

    const login = async (didValue: string) => {

        const params = {
            password,
            mainPublicKey: getStorageValue("MAIN_PUBLIC_KEY"),
            mainPrivateKey: getStorageValue("MAIN_PRIVATE_KEY"),
            userid: getStorageValue("USER_ID"),
            didType,
            didValue,
        }

        const {
            tempPrivateKey,
            tempPublicKey,
            pubkeyExpiredTimestamp,
            mainPrivateKey,
            mainPublicKey,
        } = await Client.register.login(params);

        localStorage.setItem("TEMP_PRIVATE_KEY", tempPrivateKey)
        localStorage.setItem("TEMP_PUBLIC_KEY", tempPublicKey)
        localStorage.setItem('PUBKEY_EXPIRED_TIMESTAMP', String(pubkeyExpiredTimestamp));

        setLoggedIn(!loggedIn)

        return {
            tempPrivateKey,
            tempPublicKey,
            pubkeyExpiredTimestamp,
            mainPrivateKey,
            mainPublicKey,

        }
    }

    const expiredKeys = () => {
        const timestamp = getStorageValue('PUBKEY_EXPIRED_TIMESTAMP');
        return timestamp ? Number(timestamp) < Date.now() : true;
    }

    const init = async () => {
        const fastUrl = await Client.init({
            connectUrl: getStorageValue("FAST_URL"),
            app_key: "OVEEGLRxtqXcEIJN",
        });
        localStorage.setItem("FAST_URL", fastUrl);

        setInitUpdate(true)
    }

    const hasKeys = useMemo(() => {
        const PrivateKey = getStorageValue('TEMP_PRIVATE_KEY');
        const PublicKey = getStorageValue('TEMP_PUBLIC_KEY');
        const userid = getStorageValue('USER_ID');
        if (PrivateKey && PublicKey && userid) {
            return { PrivateKey, PublicKey, userid };
        }
        return null;
    }, [loggedIn]);

    const client = useMemo(() => {
        if (hasKeys && initUpdate) {
            return Client.getInstance(hasKeys);
        }
        return null;
    }, [hasKeys, loggedIn]);

    const loginFlow = async () => {
        setLoading(true)
        try {
            await init();
        } catch (e) {
            console.log("init", e)
        }

        const { userExist, didValue } = await connect();

        if (!hasKeys || expiredKeys()) {
            try {
                await createKeyPairs(didValue);
            } catch (e) {
                console.log("key", e)
            }
        }

        if (userExist) {
            try {
                await login(didValue);
            } catch (e) {
                console.log("login", e)
            }
        } else {
            try {
                await register(didValue);
            } catch (e) {
                console.log("register", e)
            } finally {
                try {
                    await login(didValue);
                } catch (e) {
                    console.log("login", e)
                }
            }
        }

        setLoading(false)
    }

    return {
        login,
        init,
        connect,
        createKeyPairs,
        register,
        userId: getStorageValue("USER_ID"),
        tempPrivateKey: getStorageValue("TEMP_PRIVATE_KEY"),
        tempPublicKey: getStorageValue("TEMP_PUBLIC_KEY"),
        client,
        userExist,
        loginFlow,
        loading,
        loggedIn
    }
}