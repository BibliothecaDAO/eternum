import{j as e,d as h}from"./index-Ca64bMZ6.js";import{g as t,P as j,a as m,U as p,o as l,X as g}from"./index-CwGDmRQ0.js";import{f as c,d as f}from"./formatting-Bhj-HXwQ.js";import{R as u}from"./ResourceIcon-CacQ27UV.js";function v(s){return s.replace(/([A-Z])/g," $1").trim()}function b(){return e.jsx(e.Fragment,{children:Object.entries(t.questResources).map(([s,n],i)=>e.jsxs("div",{className:"my-4 p-3 ",children:[e.jsx("div",{className:"font-bold mb-2",children:v(j[Number(s)])}),e.jsx("div",{className:"grid grid-cols-6 gap-2",children:n.map((r,x)=>{const a=m(r.resource);return e.jsxs("div",{className:"flex items-center gap-1 px-2 py-1.5 rounded-md",children:[e.jsx(u,{size:24,id:r.resource,name:(a==null?void 0:a.trait)||""}),e.jsxs("span",{className:"font-medium",children:[c(r.amount),"K"]})]},x)})})]},i))})}function d({level:s}){const n=p[s];return n.length===0?null:e.jsxs("div",{className:"my-4 p-3",children:[e.jsx("div",{className:"font-bold mb-2",children:"Upgrade costs:"}),e.jsx("div",{className:"grid grid-cols-2 sm:grid-cols-3 gap-2",children:n.map(i=>{const r=m(i.resource);return e.jsxs("div",{className:"flex items-center gap-2 px-3 py-1.5",children:[e.jsx(u,{size:24,id:i.resource,name:(r==null?void 0:r.trait)||""}),e.jsxs("span",{className:"font-medium",children:[c(i.amount),"K"]})]},i.resource)})})]})}const N={title:"Realms",description:"undefined"};function o(s){const n={a:"a",blockquote:"blockquote",div:"div",em:"em",h1:"h1",h2:"h2",header:"header",li:"li",p:"p",strong:"strong",ul:"ul",...h(),...s.components};return e.jsxs(e.Fragment,{children:[e.jsx(n.header,{children:e.jsxs(n.h1,{id:"realms",children:["Realms",e.jsx(n.a,{"aria-hidden":"true",tabIndex:"-1",href:"#realms",children:e.jsx(n.div,{"data-autolink-icon":!0})})]})}),`
`,e.jsx(n.p,{children:`Originally created as "Realms (For Adventurers)", they were the first Loot derivative, comprising 8,000 generative maps
with unique metadata of resources and traits.`}),`
`,e.jsxs(n.h2,{id:"realm-access",children:["Realm Access",e.jsx(n.a,{"aria-hidden":"true",tabIndex:"-1",href:"#realm-access",children:e.jsx(n.div,{"data-autolink-icon":!0})})]}),`
`,e.jsxs(n.ul,{children:[`
`,e.jsx(n.li,{children:"Each Realm NFT grants entry into Eternum seasons"}),`
`,e.jsx(n.li,{children:"Owners become Lords of their onchain kingdoms"}),`
`,e.jsx(n.li,{children:"Access to specific resources from the 22 available types"}),`
`]}),`
`,e.jsxs(n.h2,{id:"realm-levels",children:["Realm Levels",e.jsx(n.a,{"aria-hidden":"true",tabIndex:"-1",href:"#realm-levels",children:e.jsx(n.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(n.header,{children:e.jsxs(n.h1,{id:"realm-levels-1",children:["Realm Levels",e.jsx(n.a,{"aria-hidden":"true",tabIndex:"-1",href:"#realm-levels-1",children:e.jsx(n.div,{"data-autolink-icon":!0})})]})}),`
`,e.jsxs(n.ul,{children:[`
`,e.jsxs(n.li,{children:[e.jsx(n.strong,{children:"Settlement"}),": A small settlement with 6 buildable hexes."]}),`
`]}),`
`,e.jsx("br",{}),`
`,e.jsxs(n.ul,{children:[`
`,e.jsxs(n.li,{children:[`
`,e.jsxs(n.p,{children:[e.jsx(n.strong,{children:"City"}),": A glorious city with 18 buildable hexes."]}),`
`,e.jsx(d,{level:l.City}),`
`]}),`
`]}),`
`,e.jsx("br",{}),`
`,e.jsxs(n.ul,{children:[`
`,e.jsxs(n.li,{children:[`
`,e.jsxs(n.p,{children:[e.jsx(n.strong,{children:"Kingdom"}),": A kingdom with 36 buildable hexes."]}),`
`,e.jsx(d,{level:l.Kingdom}),`
`]}),`
`]}),`
`,e.jsx("br",{}),`
`,e.jsxs(n.ul,{children:[`
`,e.jsxs(n.li,{children:[e.jsx(n.strong,{children:"Empire"}),": A vast empire with 60 buildable hexes.",`
`,e.jsx(d,{level:l.Empire}),`
`]}),`
`]}),`
`,e.jsxs(n.h2,{id:"starting-values",children:["Starting Values",e.jsx(n.a,{"aria-hidden":"true",tabIndex:"-1",href:"#starting-values",children:e.jsx(n.div,{"data-autolink-icon":!0})})]}),`
`,e.jsxs(n.p,{children:["🏰 ",e.jsx(n.strong,{children:"Base Castle Stats"})]}),`
`,e.jsxs(n.blockquote,{children:[`
`,e.jsxs(n.ul,{children:[`
`,e.jsxs(n.li,{children:[e.jsx(n.strong,{children:"Population"}),": ",t.populationCapacity.basePopulation]}),`
`,e.jsxs(n.li,{children:[e.jsx(n.strong,{children:"Military Capacity"}),":",`
`,e.jsxs(n.ul,{children:[`
`,e.jsx(n.li,{children:"3 attacking armies"}),`
`,e.jsx(n.li,{children:"1 defending army"}),`
`]}),`
`]}),`
`,e.jsxs(n.li,{children:[e.jsx(n.strong,{children:"Resource Storage"}),":",`
`,c(f(t.carryCapacityGram[g.Storehouse])),`
`,"kg"]}),`
`]}),`
`,e.jsx(n.p,{children:e.jsx(n.em,{children:"These are the default values for a newly settled realm before any buildings are constructed."})}),`
`]}),`
`,e.jsx(n.strong,{children:"Starting resources"}),`
`,e.jsxs(n.blockquote,{children:[`
`,e.jsx(n.p,{children:`Quests have been prepared to help you learn the ropes as a newly appointed Lord of your Realm Going through these will
help you learn the game and reward you with starting resources.`}),`
`]}),`
`,e.jsx(b,{}),`
`,e.jsxs(n.h2,{id:"settlement-immunity",children:["Settlement Immunity",e.jsx(n.a,{"aria-hidden":"true",tabIndex:"-1",href:"#settlement-immunity",children:e.jsx(n.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(n.p,{children:"When first settling a realm, you receive:"}),`
`,e.jsxs(n.ul,{children:[`
`,e.jsxs(n.li,{children:[Math.floor(t.tick.armiesTickIntervalInSeconds/3600*t.battle.graceTickCount),`-hour
immunity from attacks and from attacking others`]}),`
`,e.jsx(n.li,{children:"Protection from resource raids"}),`
`,e.jsx(n.li,{children:"Time to establish basic defenses"}),`
`]})]})}function C(s={}){const{wrapper:n}={...h(),...s.components};return n?e.jsx(n,{...s,children:e.jsx(o,{...s})}):o(s)}export{C as default,N as frontmatter};
