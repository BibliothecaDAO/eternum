import{j as s,d as x}from"./index-Dw30BblS.js";import{p as t,y as u,G as r,H as c}from"./index-Uy6IXIoV.js";import{f as a}from"./formatting-Br5KoSdE.js";import{R as o}from"./ResourceIcon-DPCSwPKc.js";function d({buildingType:l}){const n=t.buildings.buildingCosts[l],j=t.resources.resourceBuildingCosts[u.Wood],g=t.resources.resourceBuildingCosts[u.Stone];return l===r.Resource?s.jsxs("div",{className:"my-4 p-3 ",children:[s.jsx("div",{className:"font-bold mb-2",children:"Building costs:"}),s.jsxs("div",{className:"flex flex-row items-center gap-4",children:[j.map(e=>{const i=c(e.resource);return s.jsxs("div",{className:"flex items-center gap-1 px-2 py-1.5 rounded-md",children:[s.jsx(o,{size:24,id:e.resource,name:(i==null?void 0:i.trait)||""}),s.jsxs("span",{className:"font-medium",children:[a(e.amount),"K"]})]},e.resource)}),s.jsx("span",{className:"",children:"or"}),g.map(e=>{const i=c(e.resource);return s.jsxs("div",{className:"flex items-center gap-1 px-2 py-1.5 rounded-md",children:[s.jsx(o,{size:24,id:e.resource,name:(i==null?void 0:i.trait)||""}),s.jsxs("span",{className:"font-medium",children:[a(e.amount),"K"]})]},e.resource)})]})]}):n.length===0?null:s.jsxs("div",{className:"my-4 p-3 ",children:[s.jsx("div",{className:"font-bold mb-2",children:"Building costs:"}),s.jsx("div",{className:"grid grid-cols-2 sm:grid-cols-3 gap-2",children:n.map(e=>{const i=c(e.resource);return s.jsxs("div",{className:"flex items-center gap-1 px-2 py-1.5 rounded-md",children:[s.jsx(o,{size:24,id:e.resource,name:(i==null?void 0:i.trait)||""}),s.jsxs("span",{className:"font-medium",children:[a(e.amount),"K"]})]},e.resource)})})]})}const y={title:"Buildings",description:"undefined"};function h(l){const n={a:"a",blockquote:"blockquote",div:"div",h1:"h1",h2:"h2",h3:"h3",header:"header",li:"li",p:"p",strong:"strong",ul:"ul",...x(),...l.components};return s.jsxs(s.Fragment,{children:[s.jsx(n.header,{children:s.jsxs(n.h1,{id:"buildings",children:["Buildings",s.jsx(n.a,{"aria-hidden":"true",tabIndex:"-1",href:"#buildings",children:s.jsx(n.div,{"data-autolink-icon":!0})})]})}),`
`,s.jsx(n.p,{children:`Buildings are essential structures in your realm that provide various benefits. Each construction increases the cost of
subsequent buildings of the same type exponentially.`}),`
`,s.jsxs(n.h2,{id:"building-types",children:["Building Types",s.jsx(n.a,{"aria-hidden":"true",tabIndex:"-1",href:"#building-types",children:s.jsx(n.div,{"data-autolink-icon":!0})})]}),`
`,s.jsxs(n.h3,{id:"basic-infrastructure",children:["Basic Infrastructure",s.jsx(n.a,{"aria-hidden":"true",tabIndex:"-1",href:"#basic-infrastructure",children:s.jsx(n.div,{"data-autolink-icon":!0})})]}),`
`,s.jsxs(n.p,{children:[s.jsx(n.strong,{children:"Worker's Hut"})," ",s.jsx("img",{src:"/buildings/workers_hut.png",alt:"Worker's Hut",width:"300",className:"float-right"})]}),`
`,s.jsx(d,{buildingType:r.WorkersHut}),`
`,s.jsxs(n.ul,{children:[`
`,s.jsx(n.li,{children:"Basic population housing"}),`
`,s.jsx(n.li,{children:"Provides population capacity"}),`
`]}),`
`,s.jsx("br",{}),`
`,s.jsxs(n.p,{children:[s.jsx(n.strong,{children:"Storehouse"})," ",s.jsx("img",{src:"/buildings/storehouse.png",alt:"Storehouse",width:"300",className:"float-right"})]}),`
`,s.jsx(d,{buildingType:r.Storehouse}),`
`,s.jsxs(n.ul,{children:[`
`,s.jsx(n.li,{children:"Increases resource storage capacity"}),`
`,s.jsx(n.li,{children:"Essential for resource management"}),`
`,s.jsx(n.li,{children:"Prevents production waste"}),`
`,s.jsx(n.li,{children:"Consider building more when storage is frequently full"}),`
`]}),`
`,s.jsx("br",{}),`
`,s.jsx("br",{}),`
`,s.jsxs(n.h3,{id:"production-buildings",children:["Production Buildings",s.jsx(n.a,{"aria-hidden":"true",tabIndex:"-1",href:"#production-buildings",children:s.jsx(n.div,{"data-autolink-icon":!0})})]}),`
`,s.jsxs(n.p,{children:[s.jsx(n.strong,{children:"Farm"})," ",s.jsx("img",{src:"/buildings/farm.png",alt:"Farm",width:"300",className:"float-right"})]}),`
`,s.jsx(d,{buildingType:r.Farm}),`
`,s.jsxs(n.ul,{children:[`
`,s.jsx(n.li,{children:"Produces Wheat"}),`
`,s.jsx(n.li,{children:"No input resources required"}),`
`,s.jsx(n.li,{children:"Provides 10% production bonus to adjacent buildings"}),`
`,s.jsx(n.li,{children:"Strategic placement is key for optimization"}),`
`]}),`
`,s.jsx("br",{}),`
`,s.jsx("br",{}),`
`,s.jsx(n.strong,{children:"Fishing Village"}),`
`,s.jsx("img",{src:"/buildings/fishing_village.png",alt:"Fishing Village",width:"300",className:"float-right"}),`
`,s.jsx(d,{buildingType:r.FishingVillage}),`
`,s.jsxs(n.ul,{children:[`
`,s.jsx(n.li,{children:"Produces Fish"}),`
`,s.jsx(n.li,{children:"No input resources required"}),`
`]}),`
`,s.jsx("br",{}),`
`,s.jsx("br",{}),`
`,s.jsxs(n.p,{children:[s.jsx(n.strong,{children:"Market"})," ",s.jsx("img",{src:"/buildings/market.png",alt:"Market",width:"300",className:"float-right"})]}),`
`,s.jsx(d,{buildingType:r.Market}),`
`,s.jsxs(n.ul,{children:[`
`,s.jsx(n.li,{children:"Produces Donkeys"}),`
`,s.jsx(n.li,{children:"Essential to keep a constant trading flow"}),`
`,s.jsx(n.li,{children:"Essential for economic growth"}),`
`]}),`
`,s.jsx("br",{}),`
`,s.jsx("br",{}),`
`,s.jsx(n.strong,{children:"Resource Facility"}),`
`,s.jsxs("div",{className:"flex",children:[s.jsx("img",{src:"/buildings/forge.png",alt:"Forge",width:"200"}),s.jsx("img",{src:"/buildings/lumber_mill.png",alt:"Lumber Mill",width:"200"}),s.jsx("img",{src:"/buildings/mine.png",alt:"Mine",width:"200"})]}),`
`,s.jsx(d,{buildingType:r.Resource}),`
`,s.jsxs(n.ul,{children:[`
`,s.jsx(n.li,{children:"Produces specified resource"}),`
`,s.jsx(n.li,{children:"Consumes some of your other realms' resources"}),`
`]}),`
`,s.jsx("br",{}),`
`,s.jsx("br",{}),`
`,s.jsxs(n.h3,{id:"military-buildings",children:["Military Buildings",s.jsx(n.a,{"aria-hidden":"true",tabIndex:"-1",href:"#military-buildings",children:s.jsx(n.div,{"data-autolink-icon":!0})})]}),`
`,s.jsxs("div",{className:"flex items-center",children:[s.jsx("img",{src:"/buildings/barracks.png",alt:"Barracks",width:"300",className:"float-left"}),s.jsxs("div",{children:[s.jsxs("p",{children:[" ",s.jsx(n.strong,{children:"Barracks:"})," Produces Knights "]}),s.jsx(d,{buildingType:r.Barracks})]})]}),`
`,s.jsxs("div",{className:"flex items-center",children:[s.jsx("img",{src:"/buildings/stable.png",alt:"Stables",width:"300",className:"float-left"}),s.jsxs("div",{children:[s.jsxs("p",{children:[" ",s.jsx(n.strong,{children:"Stables:"})," Produces Paladins "]}),s.jsx(d,{buildingType:r.Stable})]})]}),`
`,s.jsxs("div",{className:"flex items-center",children:[s.jsx("img",{src:"/buildings/archery.png",alt:"Archery Range",width:"300",className:"float-left"}),s.jsxs("div",{children:[s.jsxs("p",{children:[" ",s.jsx(n.strong,{children:"Archery Range:"})," Produces Crossbowmen "]}),s.jsx(d,{buildingType:r.ArcheryRange})]})]}),`
`,s.jsxs(n.blockquote,{children:[`
`,s.jsx(n.p,{children:"Each military building increases max army count by 1 (up to +3)"}),`
`]}),`
`,s.jsxs(n.h3,{id:"production-management",children:["Production Management",s.jsx(n.a,{"aria-hidden":"true",tabIndex:"-1",href:"#production-management",children:s.jsx(n.div,{"data-autolink-icon":!0})})]}),`
`,s.jsxs(n.p,{children:["⚙️ ",s.jsx(n.strong,{children:"Production Controls"})]}),`
`,s.jsxs(n.ul,{children:[`
`,s.jsx(n.li,{children:"Buildings can be paused/resumed"}),`
`,s.jsxs(n.li,{children:["Pausing stops:",`
`,s.jsxs(n.ul,{children:[`
`,s.jsx(n.li,{children:"Resource consumption"}),`
`,s.jsx(n.li,{children:"Resource production"}),`
`]}),`
`]}),`
`,s.jsxs(n.li,{children:["Use pausing to:",`
`,s.jsxs(n.ul,{children:[`
`,s.jsx(n.li,{children:"Prevent resource waste"}),`
`,s.jsx(n.li,{children:"Manage storage capacity"}),`
`]}),`
`]}),`
`]}),`
`,s.jsxs(n.h3,{id:"construction-management",children:["Construction Management",s.jsx(n.a,{"aria-hidden":"true",tabIndex:"-1",href:"#construction-management",children:s.jsx(n.div,{"data-autolink-icon":!0})})]}),`
`,s.jsxs(n.blockquote,{children:[`
`,s.jsxs(n.p,{children:["💡 ",s.jsx(n.strong,{children:"Cost Scaling"})]}),`
`,s.jsx(n.p,{children:"Each subsequent building costs double:"}),`
`,s.jsxs(n.ul,{children:[`
`,s.jsx(n.li,{children:"First building: Base cost"}),`
`,s.jsx(n.li,{children:"Second building: 2x base cost"}),`
`,s.jsx(n.li,{children:"Third building: 4x base cost"}),`
`]}),`
`]}),`
`,s.jsxs(n.p,{children:["🏗️ ",s.jsx(n.strong,{children:"Building Tips"})]}),`
`,s.jsxs(n.blockquote,{children:[`
`,s.jsxs(n.ul,{children:[`
`,s.jsx(n.li,{children:"Prioritize buildings based on your realm's needs"}),`
`,s.jsx(n.li,{children:"Consider population increase and capacity"}),`
`,s.jsx(n.li,{children:"Monitor resource production and storage capacity"}),`
`,s.jsx(n.li,{children:"See Production Management section for resource conservation strategies"}),`
`]}),`
`]})]})}function v(l={}){const{wrapper:n}={...x(),...l.components};return n?s.jsx(n,{...l,children:s.jsx(h,{...l})}):h(l)}export{v as default,y as frontmatter};
