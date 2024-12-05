import{r as h,j as e,d as l}from"./index-Dw30BblS.js";import{N as c,y as x,H as a,W as j,p as m}from"./index-Uy6IXIoV.js";import{R as d}from"./ResourceIcon-DPCSwPKc.js";function p(){const s=h.useMemo(()=>{const r=[];for(const i of Object.keys(c)){if(i==x.Lords)continue;const o={resource:a(Number(i)),amount:j[i],resource_type:i,cost:c[i].map(n=>{var t;return{...n,amount:n.amount*m.resources.resourcePrecision,name:((t=a(n.resource))==null?void 0:t.trait)||""}})};r.push(o)}return r},[]);return e.jsx("div",{children:e.jsxs("table",{className:"w-full border border-separate border-spacing-y-5",children:[e.jsx("thead",{children:e.jsxs("tr",{children:[e.jsx("th",{className:"border-b",children:"Resource"}),e.jsx("th",{className:"border-b",children:"Production p/s"}),e.jsx("th",{className:"border-b",children:"Cost p/s"})]})}),e.jsx("tbody",{children:s.map(r=>{var i,o;return e.jsxs("tr",{children:[e.jsx("td",{className:"border-b",children:e.jsx(d,{size:100,id:((i=r.resource)==null?void 0:i.id)||0,name:((o=r.resource)==null?void 0:o.trait)||""})}),e.jsx("td",{className:"text-center border-b",children:r.amount}),e.jsx("td",{className:"py-2 border-b",children:e.jsx("div",{className:"flex flex-col gap-4 justify-between",children:r.cost.map(n=>e.jsxs("div",{className:"grid grid-cols-2",children:[e.jsx(d,{size:50,id:n.resource,name:n.name||""}),e.jsxs("div",{className:"flex flex-col",children:[e.jsx("span",{children:n.amount}),e.jsx("span",{className:"font-bold",children:n.name})]})]},n.resource))})})]},r.resource_type)})})]})})}const y=void 0;function u(s){const r={a:"a",blockquote:"blockquote",br:"br",div:"div",h2:"h2",h3:"h3",li:"li",p:"p",strong:"strong",ul:"ul",...l(),...s.components};return e.jsxs(e.Fragment,{children:[e.jsxs(r.h2,{id:"production",children:["Production",e.jsx(r.a,{"aria-hidden":"true",tabIndex:"-1",href:"#production",children:e.jsx(r.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(r.p,{children:`Each resource incurs a production cost. To sustain production, you must balance these costs. If resources are
insufficient, production will halt until they are replenished.`}),`
`,e.jsxs(r.h3,{id:"resource-requirements",children:["Resource Requirements",e.jsx(r.a,{"aria-hidden":"true",tabIndex:"-1",href:"#resource-requirements",children:e.jsx(r.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(r.p,{children:"Producing resources requires careful planning and management:"}),`
`,e.jsxs(r.ul,{children:[`
`,e.jsxs(r.li,{children:[e.jsx(r.strong,{children:"Food Production"}),": Food is unique as it can be produced without any input resources."]}),`
`,e.jsxs(r.li,{children:[e.jsx(r.strong,{children:"Input Dependencies"}),": Most resources need other resources as inputs."]}),`
`]}),`
`,e.jsxs(r.h3,{id:"automated-production",children:["Automated Production",e.jsx(r.a,{"aria-hidden":"true",tabIndex:"-1",href:"#automated-production",children:e.jsx(r.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(r.p,{children:"Your production buildings work tirelessly to keep your realm thriving:"}),`
`,e.jsxs(r.ul,{children:[`
`,e.jsxs(r.li,{children:[e.jsx(r.strong,{children:"Automatic Operation"}),`: Resources are produced automatically when all input requirements are met, the building is
active, and storage isn't full.`]}),`
`,e.jsxs(r.li,{children:[e.jsx(r.strong,{children:"Efficiency"}),": Ensure your buildings are always operational by managing inputs and storage effectively."]}),`
`]}),`
`,e.jsxs(r.h3,{id:"resource-management",children:["Resource Management",e.jsx(r.a,{"aria-hidden":"true",tabIndex:"-1",href:"#resource-management",children:e.jsx(r.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(r.p,{children:"Effective resource management is crucial for maintaining production efficiency:"}),`
`,e.jsxs(r.ul,{children:[`
`,e.jsxs(r.li,{children:[e.jsx(r.strong,{children:"Monitor Levels"}),": Keep a close eye on your resource levels to avoid shortages."]}),`
`,e.jsxs(r.li,{children:[e.jsx(r.strong,{children:"Input Consumption"}),": Be aware that inputs are consumed even if production halts due to missing resources."]}),`
`]}),`
`,e.jsxs(r.blockquote,{children:[`
`,e.jsxs(r.p,{children:["⚠️ ",e.jsx(r.strong,{children:"Important"}),e.jsx(r.br,{}),`
`,"To optimize resource efficiency:"]}),`
`,e.jsxs(r.ul,{children:[`
`,e.jsx(r.li,{children:"Keep track of input resource levels"}),`
`,e.jsx(r.li,{children:"Pause production buildings when input resources are running low"}),`
`,e.jsx(r.li,{children:"Resume production once you have sufficient input resources"}),`
`,e.jsx(r.li,{children:"Consider setting up alerts or reminders to check resource levels"}),`
`]}),`
`]}),`
`,e.jsxs(r.h3,{id:"resource-production-table",children:["Resource Production Table",e.jsx(r.a,{"aria-hidden":"true",tabIndex:"-1",href:"#resource-production-table",children:e.jsx(r.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(p,{})]})}function v(s={}){const{wrapper:r}={...l(),...s.components};return r?e.jsx(r,{...s,children:e.jsx(u,{...s})}):u(s)}export{v as default,y as frontmatter};
