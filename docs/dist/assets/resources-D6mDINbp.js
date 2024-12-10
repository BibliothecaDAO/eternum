import{j as e,d as o}from"./index-BIPCrvl3.js";import{R as s,J as x,l as m,f as u,b as l}from"./index-D1VnJ4UU.js";import{R as n}from"./ResourceIcon-NhE1jPAw.js";import{f as d}from"./formatting-BRYgnMon.js";const j=[{rarity:"Common (Widely Available)",resources:[{name:"Wood",id:s.Wood},{name:"Stone",id:s.Stone},{name:"Coal",id:s.Coal},{name:"Copper",id:s.Copper},{name:"Obsidian",id:s.Obsidian}]},{rarity:"Uncommon (Limited Availability)",resources:[{name:"Silver",id:s.Silver},{name:"Ironwood",id:s.Ironwood},{name:"Cold Iron",id:s.ColdIron},{name:"Gold",id:s.Gold}]},{rarity:"Rare (Scarce)",resources:[{name:"Hartwood",id:s.Hartwood},{name:"Diamonds",id:s.Diamonds},{name:"Sapphire",id:s.Sapphire},{name:"Ruby",id:s.Ruby}]},{rarity:"Unique (Very Scarce)",resources:[{name:"Deep Crystal",id:s.DeepCrystal},{name:"Ignium",id:s.Ignium},{name:"Ethereal Silica",id:s.EtherealSilica},{name:"True Ice",id:s.TrueIce},{name:"Twilight Quartz",id:s.TwilightQuartz},{name:"Alchemical Silver",id:s.AlchemicalSilver}]},{rarity:"Mythic (Extremely Rare)",resources:[{name:"Adamantine",id:s.Adamantine},{name:"Mithral",id:s.Mithral},{name:"Dragonhide",id:s.Dragonhide}]}],b=()=>e.jsx("div",{className:"overflow-x-auto",children:e.jsxs("table",{className:"min-w-full bg-gray",children:[e.jsx("thead",{children:e.jsxs("tr",{children:[e.jsx("th",{className:"py-2 px-4 border-b-2 border-gray-300 text-left",children:"Rarity"}),e.jsx("th",{className:"py-2 px-4 border-b-2 border-gray-300 text-left",children:"Resources"})]})}),e.jsx("tbody",{children:j.map(i=>e.jsxs("tr",{children:[e.jsx("td",{className:"py-2 px-4 border-b border-gray-300",children:i.rarity}),e.jsx("td",{className:"py-2 px-4 border-b border-gray-300",children:e.jsx("div",{className:"flex items-baseline gap-1",children:i.resources.map(r=>e.jsx(n,{name:r.name,id:r.id},r.id))})})]},i.rarity))})]})});function p(){const i=[s.Paladin,s.Knight,s.Crossbowman];return e.jsxs("div",{className:"my-4 p-4",children:[e.jsx("div",{className:"font-bold mb-6 text-xl",children:"Military Units"}),e.jsx("div",{className:"grid grid-cols-1 lg:grid-cols-3 gap-6",children:i.map(r=>{const a=x(r),h=m[r],t=u[r];return e.jsxs("div",{className:"border border-gray-700 p-4 rounded-lg bg-white/5",children:[e.jsxs("div",{className:"flex items-center gap-2 mb-4",children:[e.jsx(n,{size:"xl",id:r,name:(a==null?void 0:a.trait)||""}),e.jsx("span",{className:"text-md font-semibold truncate",children:(a==null?void 0:a.trait)||"Unknown"})]}),e.jsxs("div",{className:"mb-2 font-bold",children:["⚡️ Stamina: ",e.jsx("span",{className:"text-gray-400",children:h})]}),e.jsx("div",{className:"text-sm font-bold mb-2",children:"Food consumed / unit:"}),e.jsxs("div",{className:"grid grid-cols-3 gap-2",children:[e.jsxs("div",{className:"text-left",children:[e.jsx("div",{children:"Travel"}),e.jsx("div",{className:"text-gray-400",children:d(t.travel_wheat_burn_amount)}),e.jsx("div",{className:"text-gray-400",children:d(t.travel_fish_burn_amount)})]}),e.jsxs("div",{className:"text-left",children:[e.jsx("div",{children:"Explore"}),e.jsx("div",{className:"text-gray-400",children:d(t.explore_wheat_burn_amount)}),e.jsx("div",{className:"text-gray-400",children:d(t.explore_fish_burn_amount)})]}),e.jsxs("div",{className:"flex flex-col items-center mt-6",children:[e.jsx(n,{size:"lg",id:s.Wheat,name:"Wheat"}),e.jsx(n,{size:"lg",id:s.Fish,name:"Fish"})]})]}),e.jsx("div",{className:"border-t border-gray-500 my-4"}),e.jsx("div",{className:"text-sm font-bold mb-2",children:"Stamina Consumed:"}),e.jsxs("div",{className:"grid grid-cols-3 gap-2",children:[e.jsxs("div",{className:"text-left",children:[e.jsx("div",{children:"Travel"}),e.jsx("div",{className:"text-gray-400",children:d(l.stamina.travelCost)})]}),e.jsxs("div",{className:"text-left",children:[e.jsx("div",{children:"Explore"}),e.jsx("div",{className:"text-gray-400",children:d(l.stamina.exploreCost)})]}),e.jsx("div",{className:"flex justify-center items-center mt-4",children:e.jsx("div",{children:"⚡️"})})]})]},r)})})]})}const N={title:"Resources",description:"undefined"};function c(i){const r={a:"a",div:"div",h1:"h1",h2:"h2",h3:"h3",h4:"h4",header:"header",hr:"hr",li:"li",p:"p",strong:"strong",ul:"ul",...o(),...i.components};return e.jsxs(e.Fragment,{children:[e.jsx(r.header,{children:e.jsxs(r.h1,{id:"resources",children:["Resources",e.jsx(r.a,{"aria-hidden":"true",tabIndex:"-1",href:"#resources",children:e.jsx(r.div,{"data-autolink-icon":!0})})]})}),`
`,e.jsxs(r.p,{children:["Resources are the foundation of ",e.jsx(r.strong,{children:"Eternum"}),`'s economy. Each of the 22 resources plays a vital role in the game's
ecosystem, from basic production to advanced military operations. All in-game resources can be traded freely and bridged
out as ERC20 tokens through the central bank.`]}),`
`,e.jsxs(r.h2,{id:"resource-categories",children:["Resource Categories",e.jsx(r.a,{"aria-hidden":"true",tabIndex:"-1",href:"#resource-categories",children:e.jsx(r.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(r.hr,{}),`
`,e.jsxs(r.h3,{id:"basic-resources",children:["Basic Resources",e.jsx(r.a,{"aria-hidden":"true",tabIndex:"-1",href:"#basic-resources",children:e.jsx(r.div,{"data-autolink-icon":!0})})]}),`
`,e.jsxs(r.h4,{id:"food",children:["Food",e.jsx(r.a,{"aria-hidden":"true",tabIndex:"-1",href:"#food",children:e.jsx(r.div,{"data-autolink-icon":!0})})]}),`
`,e.jsxs("div",{className:"flex items-baseline gap-1",children:[e.jsx(n,{name:"Wheat",id:254}),e.jsx(n,{name:"Fish",id:255})]}),`
`,e.jsx(r.p,{children:"Food is the cornerstone of your realm's economy:"}),`
`,e.jsxs(r.ul,{children:[`
`,e.jsx(r.li,{children:"Produced without additional resource inputs"}),`
`,e.jsx(r.li,{children:"Required for most production chains"}),`
`,e.jsx(r.li,{children:"Essential for maintaining troops and construction"}),`
`]}),`
`,e.jsx(r.hr,{}),`
`,e.jsxs(r.h4,{id:"resource-tiers",children:["Resource Tiers",e.jsx(r.a,{"aria-hidden":"true",tabIndex:"-1",href:"#resource-tiers",children:e.jsx(r.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(r.p,{children:"Resources are distributed across the 8,000 Realms based on rarity, creating natural scarcity and trade opportunities."}),`
`,e.jsx(b,{}),`
`,e.jsx(r.hr,{}),`
`,e.jsxs(r.h3,{id:"strategic-resources",children:["Strategic Resources",e.jsx(r.a,{"aria-hidden":"true",tabIndex:"-1",href:"#strategic-resources",children:e.jsx(r.div,{"data-autolink-icon":!0})})]}),`
`,e.jsxs(r.h4,{id:"military",children:["Military",e.jsx(r.a,{"aria-hidden":"true",tabIndex:"-1",href:"#military",children:e.jsx(r.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(p,{}),`
`,e.jsx(r.p,{children:"Military units have unique properties:"}),`
`,e.jsxs(r.ul,{children:[`
`,e.jsx(r.li,{children:"They can be traded as resources"}),`
`,e.jsx(r.li,{children:"Cannot be converted back to tradeable form once assigned to an army"}),`
`,e.jsx(r.li,{children:"Become permanent once assigned to armies but are transferable to other armies on the same hex"}),`
`]}),`
`,e.jsxs(r.h4,{id:"transport",children:["Transport",e.jsx(r.a,{"aria-hidden":"true",tabIndex:"-1",href:"#transport",children:e.jsx(r.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx("div",{className:"flex items-baseline gap-1",children:e.jsx(n,{name:"Donkeys",id:249})}),`
`,e.jsx(r.p,{children:"Essential for logistics:"}),`
`,e.jsxs(r.ul,{children:[`
`,e.jsx(r.li,{children:"Required for moving resources"}),`
`,e.jsx(r.li,{children:"Consumed during transport"}),`
`,e.jsx(r.li,{children:"Critical for trade and supply chains"}),`
`]}),`
`,e.jsx(r.hr,{}),`
`,e.jsxs(r.h3,{id:"special-resources",children:["Special Resources",e.jsx(r.a,{"aria-hidden":"true",tabIndex:"-1",href:"#special-resources",children:e.jsx(r.div,{"data-autolink-icon":!0})})]}),`
`,e.jsxs(r.h4,{id:"lords-currency",children:[e.jsx(r.strong,{children:"$LORDS"})," Currency",e.jsx(r.a,{"aria-hidden":"true",tabIndex:"-1",href:"#lords-currency",children:e.jsx(r.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx("div",{className:"flex items-baseline gap-1",children:e.jsx(n,{name:"Lords",id:253})}),`
`,e.jsxs(r.p,{children:[e.jsx(r.strong,{children:"$LORDS"})," is Eternum's economic backbone:"]}),`
`,e.jsxs(r.ul,{children:[`
`,e.jsx(r.li,{children:"Used for all market transactions"}),`
`,e.jsx(r.li,{children:"Bridgeable to external networks"}),`
`,e.jsx(r.li,{children:"Required for game fees and operations"}),`
`]}),`
`,e.jsxs(r.h4,{id:"ancient-fragments",children:["Ancient Fragments",e.jsx(r.a,{"aria-hidden":"true",tabIndex:"-1",href:"#ancient-fragments",children:e.jsx(r.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx("div",{className:"flex items-baseline gap-1",children:e.jsx(n,{name:"Ancient Fragments",id:29})}),`
`,e.jsx(r.p,{children:"Strategic end-game resource:"}),`
`,e.jsxs(r.ul,{children:[`
`,e.jsx(r.li,{children:"Only found in world map Fragment Mines"}),`
`,e.jsx(r.li,{children:"Required for Hyperstructures"}),`
`,e.jsx(r.li,{children:"Cannot be produced by Realms"}),`
`]})]})}function R(i={}){const{wrapper:r}={...o(),...i.components};return r?e.jsx(r,{...i,children:e.jsx(c,{...i})}):c(i)}export{R as default,N as frontmatter};
