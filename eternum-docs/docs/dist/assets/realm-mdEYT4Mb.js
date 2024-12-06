import{j as e,d as c}from"./index-BFDTgyWJ.js";import{U as h,a as u,o as l,g as i,X as x}from"./index-CDgD-HsN.js";import{R as m}from"./ResourceIcon-DmQfGj87.js";import{f as j,d as p}from"./formatting-BkSgqWV6.js";function a({level:s}){const n=h[s],o=r=>r<1e3?`${r}K`:`${Math.floor(r/1e3)}M`;return n.length===0?null:e.jsxs("div",{className:"my-4 p-3",children:[e.jsx("div",{className:"font-bold mb-2",children:"Upgrade costs:"}),e.jsx("div",{className:"grid grid-cols-2 sm:grid-cols-3 gap-2",children:n.map(r=>{const t=u(r.resource);return e.jsxs("div",{className:"flex items-center gap-2 px-3 py-1.5",children:[e.jsx(m,{size:24,id:r.resource,name:(t==null?void 0:t.trait)||""}),e.jsx("span",{className:"font-medium",children:o(r.amount)})]},r.resource)})})]})}const y={title:"Realms",description:"undefined"};function d(s){const n={a:"a",blockquote:"blockquote",div:"div",em:"em",h1:"h1",h2:"h2",header:"header",li:"li",p:"p",strong:"strong",ul:"ul",...c(),...s.components};return e.jsxs(e.Fragment,{children:[e.jsx(n.header,{children:e.jsxs(n.h1,{id:"realms",children:["Realms",e.jsx(n.a,{"aria-hidden":"true",tabIndex:"-1",href:"#realms",children:e.jsx(n.div,{"data-autolink-icon":!0})})]})}),`
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
`,e.jsx(a,{level:l.City}),`
`]}),`
`]}),`
`,e.jsx("br",{}),`
`,e.jsxs(n.ul,{children:[`
`,e.jsxs(n.li,{children:[`
`,e.jsxs(n.p,{children:[e.jsx(n.strong,{children:"Kingdom"}),": A kingdom with 36 buildable hexes."]}),`
`,e.jsx(a,{level:l.Kingdom}),`
`]}),`
`]}),`
`,e.jsx("br",{}),`
`,e.jsxs(n.ul,{children:[`
`,e.jsxs(n.li,{children:[e.jsx(n.strong,{children:"Empire"}),": A vast empire with 60 buildable hexes.",`
`,e.jsx(a,{level:l.Empire}),`
`]}),`
`]}),`
`,e.jsxs(n.h2,{id:"starting-values",children:["Starting Values",e.jsx(n.a,{"aria-hidden":"true",tabIndex:"-1",href:"#starting-values",children:e.jsx(n.div,{"data-autolink-icon":!0})})]}),`
`,e.jsxs(n.p,{children:["🏰 ",e.jsx(n.strong,{children:"Base Castle Stats"})]}),`
`,e.jsxs(n.blockquote,{children:[`
`,e.jsxs(n.ul,{children:[`
`,e.jsxs(n.li,{children:[e.jsx(n.strong,{children:"Population"}),": ",i.populationCapacity.basePopulation]}),`
`,e.jsxs(n.li,{children:[e.jsx(n.strong,{children:"Military Capacity"}),":",`
`,e.jsxs(n.ul,{children:[`
`,e.jsx(n.li,{children:"3 attacking armies"}),`
`,e.jsx(n.li,{children:"1 defending army"}),`
`]}),`
`]}),`
`,e.jsxs(n.li,{children:[e.jsx(n.strong,{children:"Resource Storage"}),":",`
`,j(p(i.carryCapacityGram[x.Storehouse])),`
`,"kg"]}),`
`]}),`
`,e.jsx(n.p,{children:e.jsx(n.em,{children:"These are the default values for a newly settled realm before any buildings are constructed."})}),`
`]}),`
`,e.jsxs(n.h2,{id:"settlement-immunity",children:["Settlement Immunity",e.jsx(n.a,{"aria-hidden":"true",tabIndex:"-1",href:"#settlement-immunity",children:e.jsx(n.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(n.p,{children:"When first settling a realm, you receive:"}),`
`,e.jsxs(n.ul,{children:[`
`,e.jsxs(n.li,{children:[`${i.tick.armiesTickIntervalInSeconds/3600*i.battle.graceTickCount}`,`-hour
immunity from attacks and from attacking others`]}),`
`,e.jsx(n.li,{children:"Protection from resource raids"}),`
`,e.jsx(n.li,{children:"Time to establish basic defenses"}),`
`]}),`
`,e.jsx(n.strong,{children:"Starting resources"}),`
`,e.jsxs(n.blockquote,{children:[`
`,e.jsx(n.p,{children:`Quests have been prepared to help you learn the ropes as a newly appointed Lord of your Realm. Going through these
will help you learn the game and reward you with starting resources. Once completed, you can claim the resources.`}),`
`]})]})}function k(s={}){const{wrapper:n}={...c(),...s.components};return n?e.jsx(n,{...s,children:e.jsx(d,{...s})}):d(s)}export{k as default,y as frontmatter};
