import{j as e,d as b}from"./index-BIPCrvl3.js";import{b as h,R as p,Q as t,J as x,t as f,e as y}from"./index-D1VnJ4UU.js";import{R as g}from"./ResourceIcon-NhE1jPAw.js";import{a as m}from"./formatting-BRYgnMon.js";function v({buildingType:r}){const i=h.buildings.buildingCosts[r]||[],d=h.resources.resourceBuildingCosts[p.Wood]||[],c=h.resources.resourceBuildingCosts[p.Stone]||[];return r===t.Resource?e.jsxs("div",{className:"my-4 p-3",children:[e.jsx("div",{className:"font-bold mb-2",children:"Building costs:"}),e.jsxs("div",{className:"flex flex-row items-center gap-4",children:[d.map(s=>{const n=x(s.resource);return e.jsxs("div",{className:"flex items-center px-2 py-2 rounded-md",children:[e.jsx(g,{size:"lg",id:s.resource,name:(n==null?void 0:n.trait)||""}),e.jsxs("div",{className:"flex flex-col",children:[e.jsx("span",{children:n==null?void 0:n.trait}),e.jsx("span",{children:m(s.amount)})]})]},s.resource)}),e.jsx("span",{children:"or"}),c.map(s=>{const n=x(s.resource);return e.jsxs("div",{className:"flex items-center gap-1 px-2 py-1.5 rounded-md",children:[e.jsx(g,{size:"lg",id:s.resource,name:(n==null?void 0:n.trait)||""}),e.jsxs("div",{className:"flex flex-col",children:[e.jsx("span",{children:n==null?void 0:n.trait}),e.jsx("span",{children:m(s.amount)})]})]},s.resource)})]})]}):!i||i.length===0?null:e.jsxs("div",{className:"my-4 p-3",children:[e.jsx("div",{className:"font-bold mb-2",children:"Building costs:"}),e.jsx("div",{className:"grid grid-cols-2 gap-2",children:i.map(s=>{const n=x(s.resource);return e.jsxs("div",{className:"flex items-center gap-1 px-2 py-1.5 rounded-md",children:[e.jsx(g,{size:"lg",id:s.resource,name:(n==null?void 0:n.trait)||""}),e.jsxs("div",{className:"flex flex-col",children:[e.jsx("span",{className:"font-medium",children:n==null?void 0:n.trait}),e.jsx("span",{className:"font-medium",children:m(s.amount)})]})]},s.resource)})})]})}function a({title:r,image:i,buildingType:d,description:c,multipleImages:s}){const n=f[d]||0,o=y[d]||0;return e.jsxs("div",{className:"p-6 mb-6 rounded-lg border border-gray-700 bg-white/5",children:[e.jsx("div",{className:"text-xl font-bold mb-4",children:r}),s?e.jsx("div",{className:"grid grid-cols-2 mb-4",children:i.map((l,u)=>e.jsx("img",{src:l.src,alt:l.alt,width:"250"},u))}):e.jsx("img",{src:typeof i=="string"?i:"",alt:r,width:"250",className:"float-right"}),(n!==0||o!==0)&&e.jsxs("div",{className:"mt-2 text-md text-gray-300",children:[n!==0&&e.jsxs("div",{children:[e.jsx("strong",{children:"Population:"})," +",n]}),o!==0&&e.jsxs("div",{children:[e.jsx("strong",{children:"Population Capacity:"})," +",o]})]}),e.jsx(v,{buildingType:d}),e.jsx("ul",{className:"list-disc ml-4",children:c.map((l,u)=>e.jsx("li",{children:l},u))})]})}const P={title:"Buildings",description:"undefined"};function j(r){const i={a:"a",blockquote:"blockquote",div:"div",h1:"h1",h2:"h2",h3:"h3",header:"header",li:"li",p:"p",strong:"strong",ul:"ul",...b(),...r.components};return e.jsxs(e.Fragment,{children:[e.jsx(i.header,{children:e.jsxs(i.h1,{id:"buildings",children:["Buildings",e.jsx(i.a,{"aria-hidden":"true",tabIndex:"-1",href:"#buildings",children:e.jsx(i.div,{"data-autolink-icon":!0})})]})}),`
`,e.jsx(i.p,{children:`Buildings are essential structures in your realm that provide various benefits. Each construction increases the cost of
subsequent buildings of the same type exponentially.`}),`
`,e.jsxs(i.h2,{id:"building-types",children:["Building Types",e.jsx(i.a,{"aria-hidden":"true",tabIndex:"-1",href:"#building-types",children:e.jsx(i.div,{"data-autolink-icon":!0})})]}),`
`,e.jsxs(i.h3,{id:"basic-infrastructure",children:["Basic Infrastructure",e.jsx(i.a,{"aria-hidden":"true",tabIndex:"-1",href:"#basic-infrastructure",children:e.jsx(i.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(a,{title:"Worker Hut",image:"/buildings/workers_hut.png",buildingType:t.WorkersHut,description:["Basic population housing","Provides population capacity"]}),`
`,e.jsx(a,{title:"Storehouse",image:"/buildings/storehouse.png",buildingType:t.Storehouse,description:["Increases resource storage capacity","Essential for resource management","Prevents production waste","Consider building more when storage is frequently full"]}),`
`,e.jsxs(i.h3,{id:"production-buildings",children:["Production Buildings",e.jsx(i.a,{"aria-hidden":"true",tabIndex:"-1",href:"#production-buildings",children:e.jsx(i.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(a,{title:"Farm",image:"/buildings/farm.png",buildingType:t.Farm,description:["Produces Wheat","No input resources required","Provides 10% production bonus to adjacent buildings","Strategic placement is key for optimization"]}),`
`,e.jsx(a,{title:"Fishing Village",image:"/buildings/fishing_village.png",buildingType:t.FishingVillage,description:["Produces Fish","No input resources required"]}),`
`,e.jsx(a,{title:"Market",image:"/buildings/market.png",buildingType:t.Market,description:["Produces Donkeys","Consumes $LORDS","Essential for trading"]}),`
`,e.jsx(a,{title:"Resource Facility",multipleImages:!0,image:[{src:"/buildings/forge.png",alt:"Forge"},{src:"/buildings/dragonhide.png",alt:"Dragonhide"},{src:"/buildings/mine.png",alt:"Mine"},{src:"/buildings/lumber_mill.png",alt:"Lumber Mill"}],buildingType:t.Resource,description:["Produces specified resource","Consumes other resources"]}),`
`,e.jsxs(i.h3,{id:"military-buildings",children:["Military Buildings",e.jsx(i.a,{"aria-hidden":"true",tabIndex:"-1",href:"#military-buildings",children:e.jsx(i.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(a,{title:"Barracks",image:"/buildings/barracks.png",buildingType:t.Barracks,description:["Produces Knights","Increases max army count by 1"]}),`
`,e.jsx(a,{title:"Stables",image:"/buildings/stable.png",buildingType:t.Stable,description:["Produces Paladins","Increases max army count by 1","Requires higher resource investment than Barracks"]}),`
`,e.jsx(a,{title:"Archery Range",image:"/buildings/archery.png",buildingType:t.ArcheryRange,description:["Produces Crossbowmen","Increases max army count by 1","Provides ranged combat capabilities"]}),`
`,e.jsxs(i.h3,{id:"production-management",children:["Production Management",e.jsx(i.a,{"aria-hidden":"true",tabIndex:"-1",href:"#production-management",children:e.jsx(i.div,{"data-autolink-icon":!0})})]}),`
`,e.jsxs(i.blockquote,{children:[`
`,e.jsxs(i.p,{children:["⚙️ ",e.jsx(i.strong,{children:"Production Controls"})]}),`
`,e.jsx(i.p,{children:"Buildings can be paused/resumed:"}),`
`,e.jsx(i.p,{children:"Pausing stops:"}),`
`,e.jsxs(i.ul,{children:[`
`,e.jsx(i.li,{children:"Resource consumption"}),`
`,e.jsx(i.li,{children:"Resource production"}),`
`]}),`
`,e.jsx(i.p,{children:"Use pausing to:"}),`
`,e.jsxs(i.ul,{children:[`
`,e.jsx(i.li,{children:"Prevent resource waste"}),`
`,e.jsx(i.li,{children:"Manage storage capacity"}),`
`]}),`
`]}),`
`,e.jsxs(i.h3,{id:"construction-management",children:["Construction Management",e.jsx(i.a,{"aria-hidden":"true",tabIndex:"-1",href:"#construction-management",children:e.jsx(i.div,{"data-autolink-icon":!0})})]}),`
`,e.jsxs(i.blockquote,{children:[`
`,e.jsxs(i.p,{children:["💡 ",e.jsx(i.strong,{children:"Cost Scaling"})]}),`
`,e.jsx(i.p,{children:"Each subsequent building costs double:"}),`
`,e.jsxs(i.ul,{children:[`
`,e.jsx(i.li,{children:"First building: Base cost"}),`
`,e.jsx(i.li,{children:"Second building: 2x base cost"}),`
`,e.jsx(i.li,{children:"Third building: 4x base cost"}),`
`]}),`
`]}),`
`,e.jsxs(i.blockquote,{children:[`
`,e.jsxs(i.p,{children:["🧱 ",e.jsx(i.strong,{children:"Building Tips"})]}),`
`,e.jsxs(i.ul,{children:[`
`,e.jsx(i.li,{children:"Prioritize buildings based on your realm's needs"}),`
`,e.jsx(i.li,{children:"Consider population increase and capacity"}),`
`,e.jsx(i.li,{children:"Monitor resource production and storage capacity"}),`
`]}),`
`]})]})}function I(r={}){const{wrapper:i}={...b(),...r.components};return i?e.jsx(i,{...r,children:e.jsx(j,{...r})}):j(r)}export{I as default,P as frontmatter};
