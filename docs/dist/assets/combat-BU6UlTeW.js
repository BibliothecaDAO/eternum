import{d as s,j as e}from"./index-BIPCrvl3.js";import{b as r}from"./index-D1VnJ4UU.js";const d=void 0;function a(i){const n={a:"a",blockquote:"blockquote",div:"div",h2:"h2",h3:"h3",h4:"h4",li:"li",p:"p",strong:"strong",ul:"ul",...s(),...i.components};return e.jsxs(e.Fragment,{children:[e.jsxs(n.h2,{id:"combat-system",children:["Combat System",e.jsx(n.a,{"aria-hidden":"true",tabIndex:"-1",href:"#combat-system",children:e.jsx(n.div,{"data-autolink-icon":!0})})]}),`
`,e.jsxs(n.p,{children:["⚔️ ",e.jsx(n.strong,{children:"Combat Advantages"})]}),`
`,e.jsx(n.p,{children:"The combat system features a strategic triangle of unit advantages:"}),`
`,e.jsxs(n.ul,{children:[`
`,e.jsxs(n.li,{children:[e.jsx(n.strong,{children:"Paladins"})," excel against Crossbowmen"]}),`
`,e.jsxs(n.li,{children:[e.jsx(n.strong,{children:"Crossbowmen"})," dominate Knights"]}),`
`,e.jsxs(n.li,{children:[e.jsx(n.strong,{children:"Knights"})," overpower Paladins"]}),`
`]}),`
`,e.jsxs(n.blockquote,{children:[`
`,e.jsx(n.p,{children:"Units deal +10% damage to their advantage target"}),`
`,e.jsx(n.p,{children:"Units receive -10% damage from their disadvantage unit"}),`
`]}),`
`,e.jsxs(n.h3,{id:"battle-duration",children:["Battle Duration",e.jsx(n.a,{"aria-hidden":"true",tabIndex:"-1",href:"#battle-duration",children:e.jsx(n.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(n.p,{children:`Combat duration scales dynamically with army sizes. Larger armies naturally result in longer engagements, while highly
uneven matchups may resolve more quickly as the stronger force overwhelms their opponent. Battles can be simulated to
determine durations.`}),`
`,e.jsxs(n.h3,{id:"battle-dynamics",children:["Battle Dynamics",e.jsx(n.a,{"aria-hidden":"true",tabIndex:"-1",href:"#battle-dynamics",children:e.jsx(n.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(n.p,{children:`Combat in Eternum is dynamic and fluid. Additional armies can reinforce either side during battle, and fighting
continues until victory is achieved or retreat is called.`}),`
`,e.jsxs(n.p,{children:["Retreating forces pay a steep price: deserting armies lose ",r.battle.TROOP_BATTLE_LEAVE_SLASH_NUM,`% of
their troops during withdrawal.`]}),`
`,e.jsxs(n.h3,{id:"siege-mechanics",children:["Siege Mechanics",e.jsx(n.a,{"aria-hidden":"true",tabIndex:"-1",href:"#siege-mechanics",children:e.jsx(n.div,{"data-autolink-icon":!0})})]}),`
`,e.jsxs(n.p,{children:["🏰 ",e.jsx(n.strong,{children:"Siege System"})]}),`
`,e.jsxs(n.blockquote,{children:[`
`,e.jsxs(n.p,{children:["When attacking a Realm or the Central Bank, combat begins with an ",r.battle.delaySeconds/3600,`
hour siege phase. During this time, defenders can:`]}),`
`,e.jsxs(n.ul,{children:[`
`,e.jsx(n.li,{children:"Transfer resources in or out of the realm"}),`
`,e.jsx(n.li,{children:"Prepare defenses"}),`
`,e.jsx(n.li,{children:"Launch an early counterattack to break the siege"}),`
`]}),`
`,e.jsx(n.p,{children:"After the siege timer expires:"}),`
`,e.jsxs(n.ul,{children:[`
`,e.jsx(n.li,{children:"Combat automatically begins"}),`
`,e.jsx(n.li,{children:"The realm enters active attack status"}),`
`,e.jsx(n.li,{children:"All resource transfers are blocked"}),`
`]}),`
`]}),`
`,e.jsxs(n.h3,{id:"raid--pillage",children:["Raid & Pillage",e.jsx(n.a,{"aria-hidden":"true",tabIndex:"-1",href:"#raid--pillage",children:e.jsx(n.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(n.p,{children:"Raiding allows you to pillage resources and potentially damage enemy structures through quick, decisive strikes."}),`
`,e.jsxs(n.h4,{id:"resource-pillaging",children:["Resource Pillaging",e.jsx(n.a,{"aria-hidden":"true",tabIndex:"-1",href:"#resource-pillaging",children:e.jsx(n.div,{"data-autolink-icon":!0})})]}),`
`,e.jsxs(n.ul,{children:[`
`,e.jsx(n.li,{children:"Raids are executed instantly"}),`
`,e.jsx(n.li,{children:"Both attacking and defending armies suffer troop losses (maximum 10%)"}),`
`,e.jsx(n.li,{children:"Successfully stealing resources depends on luck"}),`
`,e.jsx(n.li,{children:"Your stamina is completely depleted after raiding"}),`
`,e.jsx(n.li,{children:"Higher stamina when raiding increases maximum potential resource theft"}),`
`]}),`
`,e.jsxs(n.h4,{id:"building-destruction",children:["Building Destruction",e.jsx(n.a,{"aria-hidden":"true",tabIndex:"-1",href:"#building-destruction",children:e.jsx(n.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(n.p,{children:"There's a chance to destroy one random building in the raided realm:"}),`
`,e.jsxs(n.ul,{children:[`
`,e.jsx(n.li,{children:"Lower probability in inner hexes"}),`
`,e.jsx(n.li,{children:"Higher probability in outer hexes"}),`
`,e.jsxs(n.li,{children:["Can target:",`
`,e.jsxs(n.ul,{children:[`
`,e.jsx(n.li,{children:"Military buildings (reducing army capacity)"}),`
`,e.jsx(n.li,{children:"Production buildings (disrupting economy)"}),`
`,e.jsx(n.li,{children:"Storage buildings (limiting resource capacity)"}),`
`]}),`
`]}),`
`]}),`
`,e.jsxs(n.blockquote,{children:[`
`,e.jsxs(n.p,{children:["⚠️ ",e.jsx(n.strong,{children:"Warning"}),":"]}),`
`,e.jsx(n.p,{children:"Maintain adequate realm defense!"}),`
`,e.jsx(n.p,{children:"If all defending troops are eliminated during a raid, the attacking force can claim your realm."}),`
`]})]})}function c(i={}){const{wrapper:n}={...s(),...i.components};return n?e.jsx(n,{...i,children:e.jsx(a,{...i})}):a(i)}export{c as default,d as frontmatter};
