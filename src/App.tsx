import { Route, Routes } from 'react-router-dom'
import { CartProvider } from './CartContext'
import Layout from './Layout'
import StorePage from './StorePage'
import CartCheckoutPage from './CartCheckoutPage'
import TrackPage from './TrackPage'
import AdminPage from './AdminPage'

export default function App(){
  return <CartProvider><Routes><Route element={<Layout/>}>
    <Route index element={<StorePage/>}/>
    <Route path="cart" element={<CartCheckoutPage/>}/>
    <Route path="track" element={<TrackPage/>}/>
    <Route path="admin" element={<AdminPage/>}/>
  </Route></Routes></CartProvider>
}
