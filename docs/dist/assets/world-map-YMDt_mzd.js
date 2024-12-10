import{d as t,j as e}from"./index-BIPCrvl3.js";const s={title:"World Map",description:"Geography and exploration in Eternum"};function r(i){const n={a:"a",blockquote:"blockquote",div:"div",h1:"h1",h2:"h2",header:"header",li:"li",p:"p",strong:"strong",ul:"ul",...t(),...i.components};return e.jsxs(e.Fragment,{children:[e.jsx(n.header,{children:e.jsxs(n.h1,{id:"-world-map",children:["🌎 World Map",e.jsx(n.a,{"aria-hidden":"true",tabIndex:"-1",href:"#-world-map",children:e.jsx(n.div,{"data-autolink-icon":!0})})]})}),`
`,e.jsx(n.p,{children:"Eternum unfolds on an infinite, recursive hexagonal grid that scales with the player population."}),`
`,e.jsx(n.p,{children:"Players spawn in concentric circles radiating from the map's center, ensuring optimal scalability."}),`
`,e.jsx(n.p,{children:"Distance plays a crucial role, influencing trade and army movement through time-based constraints."}),`
`,e.jsx("img",{src:"/map.png",alt:"Map"}),`
`,e.jsxs(n.h2,{id:"travel--exploration",children:["Travel & Exploration",e.jsx(n.a,{"aria-hidden":"true",tabIndex:"-1",href:"#travel--exploration",children:e.jsx(n.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(n.p,{children:`Armies can traverse through hexes that have already been discovered or venture into unexplored ones. This movement
consumes energy and depletes food supplies from their realm.`}),`
`,e.jsx(n.p,{children:"During exploration, armies have the opportunity to obtain random resources."}),`
`,e.jsx(n.p,{children:"Additionally, there is a small chance of discovering a Fragment mine."}),`
`,e.jsxs(n.h2,{id:"fragment-mines-",children:["Fragment Mines ",e.jsx("img",{src:"/buildings/fragment_mine.png",alt:"Fragment Mine",width:"300",className:"float-right"}),e.jsx(n.a,{"aria-hidden":"true",tabIndex:"-1",href:"#fragment-mines-",children:e.jsx(n.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(n.p,{children:`Fragment mines are the only source of Ancient Fragments and are found through exploration. When a mine is discovered,
there is: `}),`
`,e.jsxs(n.ul,{children:[`
`,e.jsx(n.li,{children:"No immunity period"}),`
`,e.jsx(n.li,{children:"No siege period"}),`
`]}),`
`,e.jsx(n.p,{children:"Each mine is defended by a random number of bandits that must be defeated to claim the mine."}),`
`,e.jsx(n.p,{children:"Mines have a fixed total capacity of Ancient Fragments and cannot produce more once depleted."}),`
`,e.jsx(n.strong,{children:"Production"}),`
`,e.jsxs(n.blockquote,{children:[`
`,e.jsxs(n.ul,{children:[`
`,e.jsx(n.li,{children:"Automatic production once claimed"}),`
`,e.jsx(n.li,{children:"No input resources required"}),`
`,e.jsx(n.li,{children:"Produces until reaching total capacity"}),`
`,e.jsx(n.li,{children:"Cannot be replenished once depleted"}),`
`]}),`
`]}),`
`,e.jsx(n.strong,{children:"Combat Strategy"}),`
`,e.jsxs(n.blockquote,{children:[`
`,e.jsx(n.p,{children:"When a mine is under attack:"}),`
`,e.jsxs(n.ul,{children:[`
`,e.jsx(n.li,{children:"Players can join either side"}),`
`,e.jsx(n.li,{children:"Option to aid bandits against other players"}),`
`]}),`
`]}),`
`,e.jsxs(n.h2,{id:"strategic-locations",children:["Strategic Locations",e.jsx(n.a,{"aria-hidden":"true",tabIndex:"-1",href:"#strategic-locations",children:e.jsx(n.div,{"data-autolink-icon":!0})})]}),`
`,e.jsxs(n.p,{children:["⚔️ ",e.jsx(n.strong,{children:"Key Points"})]}),`
`,e.jsxs(n.blockquote,{children:[`
`,e.jsxs(n.ul,{children:[`
`,e.jsx(n.li,{children:"Central Bank: Controls AMM trading fees"}),`
`,e.jsx(n.li,{children:"Fragment Mines: Required for Hyperstructures"}),`
`]}),`
`]})]})}function o(i={}){const{wrapper:n}={...t(),...i.components};return n?e.jsx(n,{...i,children:e.jsx(r,{...i})}):r(i)}export{o as default,s as frontmatter};
