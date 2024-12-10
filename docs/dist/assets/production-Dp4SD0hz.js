import{r as h,j as e,d as u}from"./index-BIPCrvl3.js";import{F as c,R as x,J as a,$ as m,b as p}from"./index-D1VnJ4UU.js";import{R as d}from"./ResourceIcon-NhE1jPAw.js";function j(){const n=h.useMemo(()=>{const r=[];for(const s of Object.keys(c)){if(s===x.Lords)continue;const o={resource:a(Number(s)),amount:m[s],resource_type:s,cost:c[s].map(t=>{var i;return{...t,amount:t.amount*p.resources.resourcePrecision,name:((i=a(t.resource))==null?void 0:i.trait)||""}})};r.push(o)}return r},[]);return e.jsxs("div",{className:"px-6 pt-6 mb-6 rounded-lg border border-gray-200 dark:border-gray-700 bg-white/5",children:[e.jsx("h4",{className:"text-xl font-bold mb-4",children:"Resource Table"}),e.jsxs("table",{className:"w-full border-separate border-spacing-y-5",children:[e.jsx("thead",{children:e.jsxs("tr",{children:[e.jsx("th",{className:"border-b pb-2 text-left",children:"Resource"}),e.jsx("th",{className:"border-b pb-2 text-center",children:"Production p/s"}),e.jsx("th",{className:"border-b pb-2 text-left",children:"Cost p/s"})]})}),e.jsx("tbody",{children:n.map(r=>{var s,o,t;return e.jsxs("tr",{children:[e.jsx("td",{className:"border-b py-4",children:e.jsxs("div",{className:"flex items-center gap-4",children:[e.jsx(d,{size:"xl",id:((s=r.resource)==null?void 0:s.id)||0,name:((o=r.resource)==null?void 0:o.trait)||""}),e.jsx("div",{className:"text-lg text-gray-400 dark:text-gray-300 font-medium",children:((t=r.resource)==null?void 0:t.trait)||"Unknown Resource"})]})}),e.jsx("td",{className:"text-center border-b",children:r.amount}),e.jsx("td",{className:"py-2 border-b",children:e.jsx("div",{className:"flex flex-col gap-4",children:r.cost.map(i=>e.jsx("div",{className:"p-3 rounded-lg border border-gray-800 bg-gray-800",children:e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx(d,{size:"lg",id:i.resource,name:i.name||""}),e.jsxs("div",{children:[e.jsx("span",{className:"text-md",children:i.amount}),e.jsx("div",{className:"font-bold",children:i.name})]})]})},i.resource))})})]},r.resource_type)})})]})]})}const y=void 0;function l(n){const r={a:"a",blockquote:"blockquote",br:"br",div:"div",h2:"h2",h3:"h3",li:"li",p:"p",strong:"strong",ul:"ul",...u(),...n.components};return e.jsxs(e.Fragment,{children:[e.jsxs(r.h2,{id:"production",children:["Production",e.jsx(r.a,{"aria-hidden":"true",tabIndex:"-1",href:"#production",children:e.jsx(r.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(r.p,{children:`Each resource incurs a production cost. To sustain production, you must balance these costs. If resources are
insufficient, production will halt until they are replenished but will deplete the available input resources until it
paused.`}),`
`,e.jsxs(r.h3,{id:"resource-requirements",children:["Resource Requirements",e.jsx(r.a,{"aria-hidden":"true",tabIndex:"-1",href:"#resource-requirements",children:e.jsx(r.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(r.p,{children:"Producing resources requires careful planning and management:"}),`
`,e.jsxs(r.ul,{children:[`
`,e.jsxs(r.li,{children:[e.jsx(r.strong,{children:"Food Production"}),": Food is unique as it can be produced without any input resources."]}),`
`,e.jsxs(r.li,{children:[e.jsx(r.strong,{children:"Input Dependencies"}),": Most resources consume other resources as inputs in order to produce."]}),`
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
`,e.jsx(r.li,{children:"Pause production on buildings when input resources are running low"}),`
`,e.jsx(r.li,{children:"Resume production once you have sufficient input resources"}),`
`,e.jsx(r.li,{children:"Consider setting up alerts or reminders to check resource levels"}),`
`]}),`
`]}),`
`,e.jsxs(r.h3,{id:"resource-production-table",children:["Resource Production Table",e.jsx(r.a,{"aria-hidden":"true",tabIndex:"-1",href:"#resource-production-table",children:e.jsx(r.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(j,{})]})}function v(n={}){const{wrapper:r}={...u(),...n.components};return r?e.jsx(r,{...n,children:e.jsx(l,{...n})}):l(n)}export{v as default,y as frontmatter};
