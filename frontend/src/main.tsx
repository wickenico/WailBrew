import React from 'react'
import {createRoot} from 'react-dom/client'
import './style.css'
import './i18n'
import WailBrewApp from './App'

const container = document.getElementById('root')

const root = createRoot(container!)

root.render(
    <React.StrictMode>
        <WailBrewApp/>
    </React.StrictMode>
)
