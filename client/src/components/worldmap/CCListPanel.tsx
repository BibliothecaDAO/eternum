import { useState } from "react";
import { useDojo } from "../../DojoContext";

export const CCListPanel = ({ }: any) => {
    const {
        setup: {
            systemCalls: { mint_cc },
        },
        account: { account },
    } = useDojo();


    const clickHandler = async () => {

        console.log(account);

        await mint_cc({ signer: account });

        alert("Minted");
    }

    const [ccTokens] = useState([
        { id: 1, name: 'apple' },
        { id: 2, name: 'banana' },
        { id: 3, name: 'orange' }
    ])

    return (
        <>
            <div
                className="flex w-full justify-center bg-gradient-to-t from-black to-[#151515]  p-2 border-y border-gold"
                role="tablist" aria-orientation="horizontal">
                <button
                    className="text-xxs px-3 !outline-none border border-transparent transition-color duration-200 border !border-white rounded-md text-white"
                    id="headlessui-tabs-tab-:r26:" role="tab" type="button" aria-selected="true"
                    data-headlessui-state="selected" aria-controls="headlessui-tabs-panel-:r2a:">
                    <div className="flex relative group flex-col items-center">
                        <div onClick={clickHandler}>Mint</div>
                    </div>
                </button>


            </div>


            <div className="flex flex-col space-y-2 px-2 mb-2">

                {ccTokens.map((item, index) => (
                    <div key={item.id} className="flex flex-row">
                        <div className="flex flex-col p-2 border rounded-md border-gray-gold text-xxs text-gray-gold">
                            <div className="flex items-center">
                                <div
                                    className="flex items-center p-1 -mt-2 -ml-2 border border-t-0 border-l-0 rounded-br-md border-gray-gold">
                                    <div className="relative group">
                                        <div className="w-4 h-4 flex justify-center paper mr-1">
                                            {/*<svg viewBox="0 0 49 92" fill="none" xmlns="http://www.w3.org/2000/svg"*/}
                                            {/*     className="stroke-8 stroke-order-power">*/}
                                            {/*    <path d="M4 50L31 4L26 35H45L17 88L23 50H4Z" stroke-linecap="round"*/}
                                            {/*          stroke-linejoin="round"></path>*/}
                                            {/*</svg>*/}
                                        </div>
                                        <div
                                            className="absolute flex -top-2 flex-col items-center -translate-y-full hidden left-1/2 -translate-x-1/2 bg-black rounded-lg w-max group-hover:flex">
                                            <span
                                                className="relative z-10 p-2 text-xs leading-none text-white whitespace-no-wrap rounded shadow-lg bg-gray-1000">Order of <span
                                                    className="capitalize">power</span></span>
                                            <div
                                                className="z-[100] w-3 h-3 bottom-0 left-1/2 translate-y-1/2 -translate-x-1/2 absolute rotate-45 bg-black"></div>
                                        </div>
                                    </div>
                                    lel Kúbklor
                                </div>
                                <div className="-mt-2 ml-2 italic">owned by <span
                                    className="text-gold">0x0x01...1b6c</span>
                                </div>

                            </div>
                            <div className="flex items-end mt-2">
                                <div className="flex items-center justify-around flex-1">
                                    <div className="flex-1 text-gold flex items-center flex-wrap">Resources:
                                        <div className="flex flex-col items-center mx-2 my-0.5">
                                            <div
                                                className="flex self-center w-min paper relative group rounded-xl justify-center w-full undefined">
                                                <span className=" mx-auto w-2 md:w-4 mb-1 "><svg viewBox="0 0 129 129"
                                                    fill="none"
                                                    xmlns="http://www.w3.org/2000/svg"><path
                                                        d="M4.49403 68.0145C2.54141 66.0619 2.54141 62.8961 4.49403 60.9435L39.3027 26.1348L44.4205 21.017L60.9018 4.53569C62.8544 2.58307 66.0202 2.58308 67.9729 4.5357L71.2176 7.7804L75.5206 12.0835L83.7668 20.3296L89.572 26.1348L124.381 60.9435C126.333 62.8961 126.333 66.0619 124.381 68.0145L89.572 102.823L83.7668 108.628L67.9729 124.422C66.0203 126.375 62.8544 126.375 60.9018 124.422L45.1079 108.628L39.3027 102.823L12.0418 75.5623L7.73874 71.2592L4.49403 68.0145Z"
                                                        fill="#292929"></path><path
                                                            d="M64.5599 127.958L45.2304 108.628L39.4252 102.823L12.1634 75.5612L7.83503 71.2329L1.08105 64.4789L20.2531 45.3068L27.349 51.75L31.8833 55.8672L39.4252 62.7155L45.2304 67.9868L64.5599 85.5384L83.8894 67.9868L89.6946 62.7155L108.867 45.3068L128.039 64.4789L89.6946 102.823L86.792 105.726L83.8894 108.628L64.5599 127.958Z"
                                                            fill="black"></path><path fill-rule="evenodd" clip-rule="evenodd"
                                                                d="M59.8408 2.18412L23.2438 38.7814L26.7793 42.3169L63.3763 5.71964C63.9621 5.13385 64.9119 5.13385 65.4976 5.71964L123.32 63.5416C123.905 64.1274 123.905 65.0771 123.32 65.6629L88.5159 100.467L92.0514 104.002L126.855 69.1985C129.394 66.6601 129.394 62.5445 126.855 60.0061L69.0332 2.1841C66.4948 -0.354311 62.3792 -0.354305 59.8408 2.18412Z"
                                                                fill="black"></path><path fill-rule="evenodd"
                                                                    clip-rule="evenodd"
                                                                    d="M69.0329 127.02L116.132 79.9216L112.596 76.3861L65.4974 123.485C64.9116 124.071 63.9618 124.071 63.376 123.485L5.55405 65.6629C4.96826 65.0771 4.96826 64.1274 5.55405 63.5416L20.7474 48.3482L17.2119 44.8127L2.01852 60.006C-0.519892 62.5445 -0.519892 66.66 2.01852 69.1984L59.8405 127.02C62.3789 129.559 66.4945 129.559 69.0329 127.02Z"
                                                                    fill="black"></path><path
                                                                        d="M21.4414 46.6213C21.4414 48.002 20.3221 49.1213 18.9414 49.1213C17.5607 49.1213 16.4414 48.002 16.4414 46.6213C16.4414 45.2406 17.5607 44.1213 18.9414 44.1213C20.3221 44.1213 21.4414 45.2406 21.4414 46.6213Z"
                                                                        fill="black"></path><path
                                                                            d="M27.4819 40.5779C27.4819 41.9586 26.3626 43.0779 24.9819 43.0779C23.6012 43.0779 22.4819 41.9586 22.4819 40.5779C22.4819 39.1972 23.6012 38.0779 24.9819 38.0779C26.3626 38.0779 27.4819 39.1972 27.4819 40.5779Z"
                                                                            fill="black"></path><path
                                                                                d="M78.3434 14.6748L14.6455 78.7532L16.875 81.1501L80.4682 17.1396L78.3434 14.6748Z"
                                                                                fill="white"></path><path fill-rule="evenodd" clip-rule="evenodd"
                                                                                    d="M59.8408 2.18412L23.2438 38.7814L26.7793 42.3169L63.3763 5.71964C63.9621 5.13385 64.9119 5.13385 65.4976 5.71964L123.32 63.5416C123.905 64.1274 123.905 65.0771 123.32 65.6629L88.5159 100.467L92.0514 104.002L126.855 69.1985C129.394 66.6601 129.394 62.5445 126.855 60.0061L69.0332 2.1841C66.4948 -0.354311 62.3792 -0.354305 59.8408 2.18412Z"
                                                                                    fill="white"></path><path fill-rule="evenodd"
                                                                                        clip-rule="evenodd"
                                                                                        d="M69.0329 127.02L116.132 79.9216L112.596 76.3861L65.4974 123.485C64.9116 124.071 63.9618 124.071 63.376 123.485L5.55405 65.6629C4.96827 65.0771 4.96827 64.1274 5.55405 63.5416L20.7474 48.3482L17.2119 44.8127L2.01852 60.006C-0.519892 62.5445 -0.519892 66.66 2.01852 69.1984L59.8405 127.02C62.3789 129.559 66.4945 129.559 69.0329 127.02Z"
                                                                                        fill="white"></path><path
                                                                                            d="M21.4414 46.6213C21.4414 48.002 20.3221 49.1213 18.9414 49.1213C17.5607 49.1213 16.4414 48.002 16.4414 46.6213C16.4414 45.2406 17.5607 44.1213 18.9414 44.1213C20.3221 44.1213 21.4414 45.2406 21.4414 46.6213Z"
                                                                                            fill="white"></path><path
                                                                                                d="M27.4819 40.5779C27.4819 41.9586 26.3626 43.0779 24.9819 43.0779C23.6012 43.0779 22.4819 41.9586 22.4819 40.5779C22.4819 39.1972 23.6012 38.0779 24.9819 38.0779C26.3626 38.0779 27.4819 39.1972 27.4819 40.5779Z"
                                                                                                fill="white"></path><path
                                                                                                    d="M8.26855 71.6322L71.1787 8.59363L75.5616 12.9767L12.6519 76.0152L8.26855 71.6322Z"
                                                                                                    fill="white"></path></svg></span>
                                                <div
                                                    className="absolute flex -top-2 flex-col items-center hidden -translate-y-full left-1/2 -translate-x-1/2 bg-black rounded-lg w-max group-hover:flex">
                                                    <span
                                                        className="relative z-10 p-2 text-xs leading-none text-white whitespace-no-wrap rounded shadow-lg bg-gray-1000">Obsidian</span>
                                                    <div
                                                        className="z-[100] w-3 h-3 bottom-0 left-1/2 translate-y-1/2 -translate-x-1/2 absolute rotate-45 bg-black"></div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-center mx-2 my-0.5">
                                            <div
                                                className="flex self-center w-min paper relative group rounded-xl justify-center w-full undefined">
                                                <span className=" mx-auto w-2 md:w-4 mb-1 "><svg viewBox="0 0 129 128"
                                                    fill="none"
                                                    xmlns="http://www.w3.org/2000/svg"><path
                                                        d="M122.399 124.802C125.39 124.802 127.323 121.639 125.958 118.977L94.5972 57.8226L19.4388 124.802H122.399Z"
                                                        fill="#3B3B3B"></path><path
                                                            d="M68.5044 6.94075C67.0174 4.04107 62.8728 4.04107 61.3858 6.94075L3.93235 118.977C2.56735 121.639 4.50026 124.802 7.49164 124.802H19.4388L94.5972 57.8226L68.5044 6.94075Z"
                                                            fill="#838383"></path><path
                                                                d="M96.9866 65.638L25.6343 123.789H18.0054L91.3158 54.1475L96.9866 65.638Z"
                                                                fill="#A8FFF6"></path><path
                                                                    d="M70.4147 6.37092C68.1376 1.93039 61.7343 1.9304 59.4571 6.37093L7.99383 106.726L12.1334 108.993L63.6716 8.4917C64.1971 7.46695 65.6748 7.46696 66.2002 8.49169L70.4147 6.37092Z"
                                                                    fill="white"></path><path
                                                                        d="M70.4147 6.37092L66.2002 8.49169L71.616 19.0526L75.7513 16.7775L70.4147 6.37092Z"
                                                                        fill="white"></path><path
                                                                            d="M80.902 26.8214L76.7667 29.0966L79.5998 34.6213L83.781 32.4357L80.902 26.8214Z"
                                                                            fill="white"></path><path
                                                                                d="M124.038 121.276L128.252 119.156L87.1995 39.1018L83.0413 41.3322L124.038 121.276Z"
                                                                                fill="white"></path><path
                                                                                    d="M122.773 128C127.359 128 130.329 123.205 128.252 119.156L124.038 121.276C124.517 122.211 123.831 123.317 122.773 123.317H7.09856C6.04041 123.317 5.35498 122.211 5.83423 121.276L8.34911 116.372L4.2101 114.104L1.61976 119.156C-0.45695 123.205 2.51321 128 7.09856 128H122.773Z"
                                                                                    fill="white"></path><ellipse cx="73.6594" cy="17.855" rx="2.36353"
                                                                                        ry="2.34131" fill="white"></ellipse><ellipse
                                                                                            cx="79.0061" cy="28.2809" rx="2.36354" ry="2.34131"
                                                                                            fill="white"></ellipse><ellipse cx="81.7883" cy="33.6975" rx="2.36354"
                                                                                                ry="2.34131" fill="white"></ellipse><ellipse
                                                                                                    cx="85.1809" cy="40.2886" rx="2.36353" ry="2.3413"
                                                                                                    fill="white"></ellipse><ellipse cx="10.093" cy="107.802" rx="2.36353"
                                                                                                        ry="2.3413" fill="white"></ellipse><ellipse
                                                                                                            cx="6.1565" cy="115.437" rx="2.36353" ry="2.3413"
                                                                                                            fill="white"></ellipse></svg></span>
                                                <div
                                                    className="absolute flex -top-2 flex-col items-center hidden -translate-y-full left-1/2 -translate-x-1/2 bg-black rounded-lg w-max group-hover:flex">
                                                    <span
                                                        className="relative z-10 p-2 text-xs leading-none text-white whitespace-no-wrap rounded shadow-lg bg-gray-1000">Cold Iron</span>
                                                    <div
                                                        className="z-[100] w-3 h-3 bottom-0 left-1/2 translate-y-1/2 -translate-x-1/2 absolute rotate-45 bg-black"></div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-center mx-2 my-0.5">
                                            <div
                                                className="flex self-center w-min paper relative group rounded-xl justify-center w-full undefined">
                                                <span className=" mx-auto w-2 md:w-4 mb-1 "><svg viewBox="0 0 129 128"
                                                    fill="none"
                                                    xmlns="http://www.w3.org/2000/svg"><path
                                                        fill-rule="evenodd" clip-rule="evenodd"
                                                        d="M2.94531 64C2.94531 79.6958 8.77774 94.0293 18.3935 104.952C92.8764 104.952 109.404 48.1403 108.357 19.7347C97.1728 8.76473 81.8491 2 64.9453 2C30.7037 2 2.94531 29.7583 2.94531 64Z"
                                                        fill="#C4C4C4"></path><path
                                                            d="M64.9453 126C99.187 126 126.945 98.2417 126.945 64C126.945 46.6621 119.829 30.9864 108.357 19.7347C109.404 48.1403 92.8764 104.952 18.3935 104.952C29.7554 117.857 46.3994 126 64.9453 126Z"
                                                            fill="#ADADAD"></path><path
                                                                d="M64.9453 128C100.292 128 128.945 99.3462 128.945 64C128.945 46.1038 121.594 29.9162 109.758 18.307C98.2174 6.98781 82.3928 0 64.9453 0C43.2816 0 24.1319 10.7637 12.5524 27.2348L16.2344 30.0626C26.9628 14.6927 44.7798 4.63768 64.9453 4.63768C81.1299 4.63768 95.8018 11.1146 106.51 21.6179C117.494 32.3909 124.308 47.3997 124.308 64C124.308 96.7849 97.7302 123.362 64.9453 123.362C47.1884 123.362 31.2525 115.566 20.374 103.209C11.1673 92.7518 5.58299 79.028 5.58299 64C5.58299 55.9035 7.20391 48.1856 10.1389 41.153L5.8479 39.3904C2.68944 46.9664 0.945312 55.2795 0.945312 64C0.945312 80.1989 6.96954 95.0021 16.8931 106.274C28.6147 119.588 45.8005 128 64.9453 128Z"
                                                                fill="white"></path><path
                                                                    d="M16.7539 28.5816C16.7539 29.8623 15.7157 30.9004 14.435 30.9004C13.1544 30.9004 12.1162 29.8623 12.1162 28.5816C12.1162 27.3009 13.1544 26.2628 14.435 26.2628C15.7157 26.2628 16.7539 27.3009 16.7539 28.5816Z"
                                                                    fill="white"></path><path
                                                                        d="M10.2637 40.3772C10.2637 41.6579 9.22549 42.696 7.94483 42.696C6.66417 42.696 5.62599 41.6579 5.62599 40.3772C5.62599 39.0965 6.66417 38.0584 7.94483 38.0584C9.22549 38.0584 10.2637 39.0965 10.2637 40.3772Z"
                                                                        fill="white"></path></svg></span>
                                                <div
                                                    className="absolute flex -top-2 flex-col items-center hidden -translate-y-full left-1/2 -translate-x-1/2 bg-black rounded-lg w-max group-hover:flex">
                                                    <span
                                                        className="relative z-10 p-2 text-xs leading-none text-white whitespace-no-wrap rounded shadow-lg bg-gray-1000">Stone</span>
                                                    <div
                                                        className="z-[100] w-3 h-3 bottom-0 left-1/2 translate-y-1/2 -translate-x-1/2 absolute rotate-45 bg-black"></div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-center mx-2 my-0.5">
                                            <div
                                                className="flex self-center w-min paper relative group rounded-xl justify-center w-full undefined">
                                                <span className=" mx-auto w-2 md:w-4 mb-1 "><svg viewBox="0 0 129 128"
                                                    fill="none"
                                                    xmlns="http://www.w3.org/2000/svg"><path
                                                        d="M122.419 125.641C125.405 125.641 127.339 122.487 125.983 119.825L94.5976 58.2112L19.4391 125.641H122.419Z"
                                                        fill="#E69E00"></path><path
                                                            d="M68.5097 6.99705C67.0261 4.08448 62.8649 4.08448 61.3812 6.99705L3.90784 119.825C2.55223 122.487 4.48545 125.641 7.47207 125.641H19.4391L94.5976 58.2112L68.5097 6.99705Z"
                                                            fill="#FFB000"></path><path
                                                                d="M70.4333 5.55298C68.1561 1.08259 61.7528 1.08261 59.4757 5.55298L8.01238 106.583L12.152 108.865L63.6901 7.68801C64.2156 6.65637 65.6933 6.65638 66.2188 7.688L70.4333 5.55298Z"
                                                                fill="white"></path><path
                                                                    d="M70.4333 5.55298L66.2188 7.688L71.6346 18.3199L75.7699 16.0295L70.4333 5.55298Z"
                                                                    fill="white"></path><path
                                                                        d="M80.9205 26.1409L76.7852 28.4314L79.6184 33.9933L83.7996 31.793L80.9205 26.1409Z"
                                                                        fill="white"></path><path
                                                                            d="M124.056 121.231L128.271 119.096L87.2181 38.5039L83.0598 40.7492L124.056 121.231Z"
                                                                            fill="white"></path><path
                                                                                d="M122.792 128C127.377 128 130.347 123.173 128.271 119.096L124.056 121.231C124.535 122.172 123.85 123.286 122.792 123.286H7.11712C6.05897 123.286 5.37354 122.172 5.85278 121.231L8.36767 116.294L4.22865 114.011L1.63832 119.096C-0.438395 123.173 2.53177 128 7.11712 128H122.792Z"
                                                                                fill="white"></path><ellipse cx="73.678" cy="17.1142" rx="2.36353"
                                                                                    ry="2.35704" fill="white"></ellipse><ellipse
                                                                                        cx="79.0247" cy="27.6102" rx="2.36354" ry="2.35704"
                                                                                        fill="white"></ellipse><ellipse cx="81.8069" cy="33.0632" rx="2.36354"
                                                                                            ry="2.35704" fill="white"></ellipse><ellipse
                                                                                                cx="85.1995" cy="39.6986" rx="2.36353" ry="2.35704"
                                                                                                fill="white"></ellipse><ellipse cx="10.1116" cy="107.666" rx="2.36353"
                                                                                                    ry="2.35704" fill="white"></ellipse><ellipse
                                                                                                        cx="6.17506" cy="115.352" rx="2.36353" ry="2.35704"
                                                                                                        fill="white"></ellipse></svg></span>
                                                <div
                                                    className="absolute flex -top-2 flex-col items-center hidden -translate-y-full left-1/2 -translate-x-1/2 bg-black rounded-lg w-max group-hover:flex">
                                                    <span
                                                        className="relative z-10 p-2 text-xs leading-none text-white whitespace-no-wrap rounded shadow-lg bg-gray-1000">Gold</span>
                                                    <div
                                                        className="z-[100] w-3 h-3 bottom-0 left-1/2 translate-y-1/2 -translate-x-1/2 absolute rotate-45 bg-black"></div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-center mx-2 my-0.5">
                                            <div
                                                className="flex self-center w-min paper relative group rounded-xl justify-center w-full undefined">
                                                <span className=" mx-auto w-2 md:w-4 mb-1 "><svg viewBox="0 0 134 133"
                                                    fill="none"
                                                    xmlns="http://www.w3.org/2000/svg"><path
                                                        d="M131.445 7.49725C131.445 4.73735 129.208 2.5 126.448 2.5H8.44531C5.68389 2.5 3.44531 4.73858 3.44531 7.5V106.543C105.845 106.543 131.445 40.5124 131.445 7.49725Z"
                                                        fill="#794200"></path><path
                                                            d="M3.44531 125.5C3.44531 128.261 5.68389 130.5 8.44531 130.5H126.445C129.207 130.5 131.445 128.261 131.445 125.5V7.49725C131.445 40.5124 105.845 106.543 3.44531 106.543V125.5Z"
                                                            fill="#623500"></path><path
                                                                d="M7.44531 0C3.85546 0 0.945312 2.91015 0.945312 6.5V126.5C0.945312 130.09 3.85546 133 7.44531 133V128C6.61689 128 5.94531 127.328 5.94531 126.5V6.5C5.94531 5.67157 6.61689 5 7.44531 5V0Z"
                                                                fill="white"></path><path
                                                                    d="M133.945 6.5C133.945 2.91015 131.035 0 127.445 0H27.3399V5H127.445C128.274 5 128.945 5.67157 128.945 6.5V126.5C128.945 127.328 128.274 128 127.445 128H27.3399V133H127.445C131.035 133 133.945 130.09 133.945 126.5V6.5Z"
                                                                    fill="white"></path><path d="M7.44531 128V133H17.9297V128H7.44531Z"
                                                                        fill="white"></path><path
                                                                            d="M7.44531 0V5H12.8125V0H7.44531Z" fill="white"></path><circle
                                                                                cx="17.9248" cy="130.5" r="2.5" fill="white"></circle><circle
                                                                                    cx="27.5508" cy="130.5" r="2.5" fill="white"></circle><circle
                                                                                        cx="12.9248" cy="2.5" r="2.5" fill="white"></circle><circle cx="27.4023"
                                                                                            cy="2.5"
                                                                                            r="2.5"
                                                                                            fill="white"></circle><path
                                                                                                d="M7.44531 0C3.85546 0 0.945312 2.91015 0.945312 6.5V126.5C0.945312 130.09 3.85546 133 7.44531 133V128C6.61689 128 5.94531 127.328 5.94531 126.5V6.5C5.94531 5.67157 6.61689 5 7.44531 5V0Z"
                                                                                                fill="white"></path><path
                                                                                                    d="M133.945 6.5C133.945 2.91015 131.035 0 127.445 0H27.3399V5H127.445C128.274 5 128.945 5.67157 128.945 6.5V126.5C128.945 127.328 128.274 128 127.445 128H27.3399V133H127.445C131.035 133 133.945 130.09 133.945 126.5V6.5Z"
                                                                                                    fill="white"></path><path d="M7.44531 128V133H17.9297V128H7.44531Z"
                                                                                                        fill="white"></path><path
                                                                                                            d="M7.44531 0V5H12.8125V0H7.44531Z" fill="white"></path><circle
                                                                                                                cx="17.9248" cy="130.5" r="2.5" fill="white"></circle><circle
                                                                                                                    cx="27.5508" cy="130.5" r="2.5" fill="white"></circle><circle
                                                                                                                        cx="12.9248" cy="2.5" r="2.5" fill="white"></circle><circle cx="27.4023"
                                                                                                                            cy="2.5"
                                                                                                                            r="2.5"
                                                                                                                            fill="white"></circle></svg></span>
                                                <div
                                                    className="absolute flex -top-2 flex-col items-center hidden -translate-y-full left-1/2 -translate-x-1/2 bg-black rounded-lg w-max group-hover:flex">
                                                    <span
                                                        className="relative z-10 p-2 text-xs leading-none text-white whitespace-no-wrap rounded shadow-lg bg-gray-1000">Wood</span>
                                                    <div
                                                        className="z-[100] w-3 h-3 bottom-0 left-1/2 translate-y-1/2 -translate-x-1/2 absolute rotate-45 bg-black"></div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="mt-2 space-x-2">
                                <div className="text-gold inline-block">Cities: <span className="text-white">12</span>
                                </div>
                                <div className="text-gold inline-block">Harbors: <span className="text-white">3</span>
                                </div>
                                <div className="text-gold inline-block">Rivers: <span className="text-white">20</span>
                                </div>
                                <div className="text-gold inline-block">Regions: <span className="text-white">3</span>
                                </div>
                            </div>
                        </div>
                        <div className=" text-gold flex ml-auto " style={{ float: "right" }}>
                            <img src="cc.png" style={{ width: "120px" }} />
                        </div>
                    </div>
                ))}

            </div>
            {/*<button onClick={() => clickHandler()}>Mint</button>*/}
        </>
    )
}
