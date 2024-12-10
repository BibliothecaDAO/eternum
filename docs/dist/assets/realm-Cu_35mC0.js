import{j as e,d as c}from"./index-BIPCrvl3.js";import{b as t,I as j,J as h,W as g,c as p,d as l}from"./index-D1VnJ4UU.js";import{R as u}from"./ResourceIcon-NhE1jPAw.js";import{b,a as m,f,d as v}from"./formatting-BRYgnMon.js";function y(){return e.jsx("div",{className:"grid grid-cols-1 gap-6",children:Object.entries(t.questResources).map(([r,s])=>e.jsxs("div",{className:"p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white/5",children:[e.jsx("div",{className:"font-bold text-lg mb-4",children:b(j[Number(r)]||"Unknown Quest")}),e.jsx("div",{className:"grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4",children:s.map((a,i)=>{const n=h(a.resource),x=(n==null?void 0:n.trait)||"Unknown Resource";return e.jsxs("div",{className:"flex items-center px-4 py-2 rounded-md bg-gray-800",children:[e.jsx(u,{size:"lg",id:a.resource,name:x}),e.jsx("span",{className:"font-medium text-gray-300 ml-4",children:m(a.amount)})]},i)})})]},r))})}function d({level:r,description:s}){const a=g[r]||[];return e.jsxs("div",{className:"p-6 mb-6 rounded-lg border border-gray-200 dark:border-gray-700 bg-white/5",children:[e.jsx("h4",{className:"text-lg font-bold mb-4",children:s}),a.length>0?e.jsx("div",{className:"grid grid-cols-2 sm:grid-cols-3 gap-4",children:a.map(i=>{const n=h(i.resource);return e.jsxs("div",{className:"flex items-center gap-2  rounded-md ",children:[e.jsx(u,{size:"lg",id:i.resource,name:(n==null?void 0:n.trait)||""}),e.jsxs("div",{className:"flex flex-col",children:[e.jsx("span",{className:"font-medium",children:n==null?void 0:n.trait}),e.jsx("span",{className:"font-medium",children:m(i.amount)})]})]},i.resource)})}):e.jsx("p",{className:"text-white",children:"Your starting realm."})]})}const I={title:"Realms",description:"undefined"};function o(r){const s={a:"a",blockquote:"blockquote",div:"div",em:"em",h1:"h1",h2:"h2",h3:"h3",header:"header",li:"li",p:"p",strong:"strong",ul:"ul",...c(),...r.components};return e.jsxs(e.Fragment,{children:[e.jsx(s.header,{children:e.jsxs(s.h1,{id:"realms",children:["Realms",e.jsx(s.a,{"aria-hidden":"true",tabIndex:"-1",href:"#realms",children:e.jsx(s.div,{"data-autolink-icon":!0})})]})}),`
`,e.jsx(s.p,{children:`Originally created as "Realms (For Adventurers)", they were the first Loot derivative, comprising 8,000 generative maps
with unique metadata of resources and traits.`}),`
`,e.jsxs(s.h2,{id:"realm-access",children:["Realm Access",e.jsx(s.a,{"aria-hidden":"true",tabIndex:"-1",href:"#realm-access",children:e.jsx(s.div,{"data-autolink-icon":!0})})]}),`
`,e.jsxs(s.ul,{children:[`
`,e.jsx(s.li,{children:"Each Realm NFT grants entry into Eternum seasons"}),`
`,e.jsx(s.li,{children:"Owners become Lords of their onchain kingdoms"}),`
`,e.jsx(s.li,{children:"Access to specific resources from the 22 available types"}),`
`]}),`
`,e.jsxs(s.h2,{id:"starting-values",children:["Starting Values",e.jsx(s.a,{"aria-hidden":"true",tabIndex:"-1",href:"#starting-values",children:e.jsx(s.div,{"data-autolink-icon":!0})})]}),`
`,e.jsxs(s.h3,{id:"-starting-resources",children:["💎 ",e.jsx(s.strong,{children:"Starting resources"}),e.jsx(s.a,{"aria-hidden":"true",tabIndex:"-1",href:"#-starting-resources",children:e.jsx(s.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(s.p,{children:`Quests have been prepared to help you learn the ropes as a newly appointed Lord of your Realm. Going through these will
help you learn the game and reward you with starting resources. Claim your resources when you complete each quest.`}),`
`,e.jsxs(s.h3,{id:"quest-rewards",children:["Quest Rewards",e.jsx(s.a,{"aria-hidden":"true",tabIndex:"-1",href:"#quest-rewards",children:e.jsx(s.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(y,{}),`
`,e.jsxs(s.h3,{id:"-base-castle-stats",children:["🏰 ",e.jsx(s.strong,{children:"Base Castle Stats"}),e.jsx(s.a,{"aria-hidden":"true",tabIndex:"-1",href:"#-base-castle-stats",children:e.jsx(s.div,{"data-autolink-icon":!0})})]}),`
`,e.jsxs(s.blockquote,{children:[`
`,e.jsxs(s.ul,{children:[`
`,e.jsxs(s.li,{children:[e.jsx(s.strong,{children:"Population"}),": ",t.populationCapacity.basePopulation]}),`
`,e.jsxs(s.li,{children:[e.jsx(s.strong,{children:"Military Capacity"}),":",`
`,e.jsxs(s.ul,{children:[`
`,e.jsx(s.li,{children:"3 attacking armies"}),`
`,e.jsx(s.li,{children:"1 defending army"}),`
`]}),`
`]}),`
`,e.jsxs(s.li,{children:[e.jsx(s.strong,{children:"Resource Storage"}),":",`
`,f(v(t.carryCapacityGram[p.Storehouse])),`
`,"kg"]}),`
`]}),`
`,e.jsx(s.p,{children:e.jsx(s.em,{children:"These are the default values for a newly settled realm before any buildings are constructed."})}),`
`]}),`
`,e.jsxs(s.h2,{id:"settlement-immunity",children:["Settlement Immunity",e.jsx(s.a,{"aria-hidden":"true",tabIndex:"-1",href:"#settlement-immunity",children:e.jsx(s.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(s.p,{children:"When first settling a realm, you receive:"}),`
`,e.jsxs(s.ul,{children:[`
`,e.jsxs(s.li,{children:[`
`,e.jsx("span",{children:e.jsxs(s.p,{children:[t.tick.armiesTickIntervalInSeconds/3600*t.battle.graceTickCount,` hour
immunity from attacks and from attacking others`]})}),`
`]}),`
`,e.jsxs(s.li,{children:[`
`,e.jsx(s.p,{children:"Protection from resource raids"}),`
`]}),`
`,e.jsxs(s.li,{children:[`
`,e.jsx(s.p,{children:"Time to establish basic defenses"}),`
`]}),`
`]}),`
`,e.jsxs(s.h2,{id:"realm-levels",children:["Realm Levels",e.jsx(s.a,{"aria-hidden":"true",tabIndex:"-1",href:"#realm-levels",children:e.jsx(s.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(s.p,{children:`As your realm grows, you will need more buildable space to expand. Upgrading your realms from a settlement to an empire
requires various resources. The costs of upgrading your realms are as follows:`}),`
`,e.jsxs(s.h3,{id:"realm-upgrade-costs",children:["Realm Upgrade Costs",e.jsx(s.a,{"aria-hidden":"true",tabIndex:"-1",href:"#realm-upgrade-costs",children:e.jsx(s.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(d,{level:l.Settlement,description:"Settlement - a small settlement with 6 buildable hexes"}),`
`,e.jsx(d,{level:l.City,description:"City - a glorious city with 18 buildable hexes"}),`
`,e.jsx(d,{level:l.Kingdom,description:"Kingdom - a kingdom with 36 buildable hexes"}),`
`,e.jsx(d,{level:l.Empire,description:"Empire - a vast empire with 60 buildable hexes"})]})}function C(r={}){const{wrapper:s}={...c(),...r.components};return s?e.jsx(s,{...r,children:e.jsx(o,{...r})}):o(r)}export{C as default,I as frontmatter};
