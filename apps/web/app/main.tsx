/// <reference types="vinxi/types/client" />

import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'

import { createRouter } from './router'
import "./index.css"

// Set up a Router instance
const router = createRouter()

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const rootElement = document.getElementById('root')!
if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement)

  root.render(
    <React.StrictMode>
      <RouterProvider router={router}  />
    </React.StrictMode>,
  )
}
