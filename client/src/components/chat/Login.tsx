import React, { useMemo, useState, useEffect } from "react";
import { Client, KeyPairsType, WalletType } from "@web3mq/client";

export const useLogin = () => {
    const [didValue, setDidValue] = useState<string>('');
    const password = '123456';
    const didType: WalletType = 'argentX' // or 'starknet';

    const connect = async () => {
        const { address: didValue } = await Client.register.getAccount(didType);
        setDidValue(didValue);

        console.log(didValue)

        const { userid, userExist } = await Client.register.getUserInfo({
            did_value: didValue,
            did_type: 'web3mq',
        });
        localStorage.setItem("USER_ID", userid)

        console.log(userid, userExist)
    }

    // 2. create main key pairs
    const createKeyPairs = async () => {
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

    const register = async () => {
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
        const registerRes = await Client.register.register(params);
        console.log(registerRes)
    }

    const login = async () => {

        const params = {
            password,
            mainPublicKey: getStorageValue("MAIN_PUBLIC_KEY"),
            mainPrivateKey: getStorageValue("MAIN_PRIVATE_KEY"),
            userid: getStorageValue("USER_ID"),
            didType,
            didValue,
        }

        console.log(params)

        const {
            tempPrivateKey,
            tempPublicKey,
            pubkeyExpiredTimestamp,
            mainPrivateKey,
            mainPublicKey,
        } = await Client.register.login(params);

        console.log(tempPrivateKey, tempPublicKey, pubkeyExpiredTimestamp, mainPrivateKey, mainPublicKey)

        localStorage.setItem("TEMP_PRIVATE_KEY", tempPrivateKey)
        localStorage.setItem("TEMP_PUBLIC_KEY", tempPublicKey)

        return {
            tempPrivateKey,
            tempPublicKey,
            pubkeyExpiredTimestamp,
            mainPrivateKey,
            mainPublicKey,

        }
    }

    const init = async () => {
        const tempPubkey = localStorage.getItem("PUBLIC_KEY") || "";
        const didKey = localStorage.getItem("DID_KEY") || "";
        const fastUrl = await Client.init({
            connectUrl: localStorage.getItem("FAST_URL"),
            app_key: "OVEEGLRxtqXcEIJN",
            // env: "dev",
            // didKey,
            // tempPubkey,
        });
        localStorage.setItem("FAST_URL", fastUrl);
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
    }
}