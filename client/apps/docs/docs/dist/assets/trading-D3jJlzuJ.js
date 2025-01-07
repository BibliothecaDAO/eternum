import{d as t,j as e}from"./index-BXZ0OpAY.js";import{b as s,J as a,a as d}from"./index-CeHJOaBa.js";const c={title:"🫏 Trading System",description:"undefined"};function i(r){const n={a:"a",blockquote:"blockquote",div:"div",h1:"h1",h2:"h2",h3:"h3",header:"header",li:"li",p:"p",strong:"strong",ul:"ul",...t(),...r.components};return e.jsxs(e.Fragment,{children:[e.jsx(n.header,{children:e.jsxs(n.h1,{id:"-trading-system",children:["🫏 Trading System",e.jsx(n.a,{"aria-hidden":"true",tabIndex:"-1",href:"#-trading-system",children:e.jsx(n.div,{"data-autolink-icon":!0})})]})}),`
`,e.jsxs(n.h2,{id:"order-book",children:["Order Book",e.jsx(n.a,{"aria-hidden":"true",tabIndex:"-1",href:"#order-book",children:e.jsx(n.div,{"data-autolink-icon":!0})})]}),`
`,e.jsxs(n.ul,{children:[`
`,e.jsx(n.li,{children:"Trade resources with other players"}),`
`,e.jsx(n.li,{children:"All trades require donkeys for transport"}),`
`,e.jsx(n.li,{children:"Resources have weight that affects transport capacity"}),`
`,e.jsx(n.li,{children:"Monitor market prices for optimal trading"}),`
`]}),`
`,e.jsxs(n.h2,{id:"automated-market-maker-amm",children:["Automated Market Maker (AMM)",e.jsx(n.a,{"aria-hidden":"true",tabIndex:"-1",href:"#automated-market-maker-amm",children:e.jsx(n.div,{"data-autolink-icon":!0})})]}),`
`,e.jsxs(n.h3,{id:"swaps",children:["Swaps",e.jsx(n.a,{"aria-hidden":"true",tabIndex:"-1",href:"#swaps",children:e.jsx(n.div,{"data-autolink-icon":!0})})]}),`
`,e.jsxs(n.p,{children:["The AMM enables players to swap resources for ",e.jsx(n.strong,{children:"$LORDS"}),` and vice versa. Exchange rates are influenced by liquidity
pools.`]}),`
`,e.jsxs(n.h3,{id:"liquidity-pools",children:["Liquidity Pools",e.jsx(n.a,{"aria-hidden":"true",tabIndex:"-1",href:"#liquidity-pools",children:e.jsx(n.div,{"data-autolink-icon":!0})})]}),`
`,e.jsxs(n.p,{children:["Players can provide liquidity by depositing resources and ",e.jsx(n.strong,{children:"$LORDS"}),` into pools. This earns trading fees proportional to
your share and helps maintain a stable trading environment, increasing overall market efficiency.`]}),`
`,e.jsxs(n.h3,{id:"liquidity-provision-rules",children:["Liquidity Provision Rules",e.jsx(n.a,{"aria-hidden":"true",tabIndex:"-1",href:"#liquidity-provision-rules",children:e.jsx(n.div,{"data-autolink-icon":!0})})]}),`
`,e.jsxs(n.ul,{children:[`
`,e.jsxs(n.li,{children:[`
`,e.jsxs(n.p,{children:[e.jsx(n.strong,{children:"Realm Ownership Requirement"}),": You must own at least one realm to provide or withdraw liquidity from the AMM"]}),`
`]}),`
`,e.jsxs(n.li,{children:[`
`,e.jsxs(n.p,{children:[e.jsx(n.strong,{children:"Liquidity Addition"}),": Adding liquidity is instant and does not require donkeys or transport time"]}),`
`]}),`
`,e.jsxs(n.li,{children:[`
`,e.jsxs(n.p,{children:[e.jsx(n.strong,{children:"Liquidity Removal"}),`: Removing liquidity requires donkeys and transport time (depending on realm distance to the
bank)`]}),`
`]}),`
`,e.jsxs(n.li,{children:[`
`,e.jsxs(n.p,{children:[e.jsx(n.strong,{children:"Account-Based Liquidity"}),": Your provided liquidity is tied to your player account, not to any specific realm"]}),`
`]}),`
`,e.jsxs(n.li,{children:[`
`,e.jsxs(n.p,{children:[e.jsx(n.strong,{children:"Flexible Withdrawal"}),`: You can withdraw liquidity using any realm you own, regardless of which realm was used to
provide it`]}),`
`]}),`
`,e.jsxs(n.li,{children:[`
`,e.jsxs(n.p,{children:[e.jsx(n.strong,{children:"Realm Selection"}),": When withdrawing liquidity, you can choose which realm receives the withdrawn resources"]}),`
`]}),`
`]}),`
`,e.jsxs(n.blockquote,{children:[`
`,e.jsxs(n.p,{children:["⚠️ ",e.jsx(n.strong,{children:"Important"}),`: Even though liquidity is tracked at the account level, you must maintain ownership of at least one
realm to manage your liquidity positions`]}),`
`]}),`
`,e.jsxs(n.h2,{id:"transport-",children:["Transport ",e.jsx("img",{src:"/resources/249.png",alt:"Donkey",width:"200",className:"float-right"}),e.jsx(n.a,{"aria-hidden":"true",tabIndex:"-1",href:"#transport-",children:e.jsx(n.div,{"data-autolink-icon":!0})})]}),`
`,e.jsxs(n.p,{children:[`Donkeys are essential for all resource transfers. Each donkey can carry up to
`,e.jsxs(n.strong,{children:[(s.carryCapacityGram[a.Donkey]/1e3).toLocaleString()," kg"]}),`, and transport
time depends on the distance to its destination. It's important to consider transport costs in your trade calculations.
Ensure your realm has the necessary resources for transportation.`]}),`
`,e.jsxs(n.h3,{id:"transporting-resources",children:["Transporting Resources",e.jsx(n.a,{"aria-hidden":"true",tabIndex:"-1",href:"#transporting-resources",children:e.jsx(n.div,{"data-autolink-icon":!0})})]}),`
`,e.jsxs(n.p,{children:["To bridge resources, visit the ",e.jsx(n.a,{href:"https://empire.realms.world/trade",children:"Empires Bridge"}),"."]}),`
`,e.jsxs(n.ul,{children:[`
`,e.jsxs(n.li,{children:[e.jsx(n.strong,{children:"Sending Resource"}),"s: When you want to send resources (like ",e.jsx(n.strong,{children:"$LORDS"}),`) to another realm, the bridge calculates the
distance and travel time based on the coordinates of your realm and the central bank. The transport time depends on
the distance and is calculated as `,d," seconds per kilometer."]}),`
`,e.jsxs(n.li,{children:[e.jsx(n.strong,{children:"Withdrawing Resources"}),`: To bridge resources out of the game, you must first travel from your realm to the central
bank. This process is not instant, resources must physically "move" to the bank. You can bridge out here
`,e.jsx("a",{href:"https://empire.realms.world/",children:"here"}),"."]}),`
`]}),`
`,e.jsxs(n.h2,{id:"-central-bank-",children:["🏦 Central Bank ",e.jsx("img",{src:"/buildings/bank.png",alt:"Bank",width:"300",className:"float-right"}),e.jsx(n.a,{"aria-hidden":"true",tabIndex:"-1",href:"#-central-bank-",children:e.jsx(n.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(n.p,{children:`The Central Bank is a neutral structure, located at the center of the map, that controls the AMM and receives a part of
its fees. The central bank acts as the hub for all bridging activities. Whether you’re sending resources to another
realm or withdrawing them, everything must pass through the central bank first.`}),`
`,e.jsx(n.p,{children:"Anyone can claim it for themselves, but be wary, as it is protected by a significant defensive force."}),`
`,e.jsxs(n.blockquote,{children:[`
`,e.jsxs(n.p,{children:["⚠️ ",e.jsx(n.strong,{children:"Note:"})," When the Bank is being attacked, the AMM will be ",e.jsx(n.strong,{children:"locked"})," until the battle has ended."]}),`
`]}),`
`,e.jsx(n.strong,{children:"Ownership Benefits:"}),`
`,e.jsxs(n.ul,{children:[`
`,e.jsx(n.li,{children:"Owner collects AMM trading fees, providing a significant source of passive income."}),`
`,e.jsx(n.li,{children:"The bank can be attacked and claimed by other players, making it a strategic target."}),`
`]}),`
`,e.jsxs(n.h2,{id:"trading-tips",children:["Trading Tips",e.jsx(n.a,{"aria-hidden":"true",tabIndex:"-1",href:"#trading-tips",children:e.jsx(n.div,{"data-autolink-icon":!0})})]}),`
`,e.jsxs(n.blockquote,{children:[`
`,e.jsxs(n.p,{children:["💡 ",e.jsx(n.strong,{children:"Strategy"})]}),`
`,e.jsxs(n.ul,{children:[`
`,e.jsx(n.li,{children:"Regularly monitor market prices"}),`
`,e.jsx(n.li,{children:"Factor in transport costs when calculating trade profits"}),`
`,e.jsx(n.li,{children:"Watch liquidity levels for better exchange rates"}),`
`,e.jsx(n.li,{children:"Ensure you have sufficient donkey capacity for efficient trading"}),`
`]}),`
`]})]})}function h(r={}){const{wrapper:n}={...t(),...r.components};return n?e.jsx(n,{...r,children:e.jsx(i,{...r})}):i(r)}export{h as default,c as frontmatter};
