import { Link, NavLink, Outlet } from 'react-router-dom'
import { PackageSearch, ShoppingBag, ShoppingCart, ShieldCheck } from 'lucide-react'
import { useCart } from './CartContext'

export default function Layout() {
  const { count } = useCart()
  return <div className="app-shell">
    <header className="topbar">
      <Link to="/" className="brand" aria-label="KM 11 Merchandise">
        <span className="brand-mark">KM<span>11</span></span>
        <span><strong>Merchandise</strong><small>Kemenkeu Mengajar 11</small></span>
      </Link>
      <nav className="navlinks">
        <NavLink to="/" end><ShoppingBag size={18}/> Katalog</NavLink>
        <NavLink to="/track"><PackageSearch size={18}/> Lacak</NavLink>
        <NavLink to="/cart" className="cart-link"><ShoppingCart size={18}/> Keranjang <b>{count}</b></NavLink>
        <NavLink to="/admin"><ShieldCheck size={18}/> Admin</NavLink>
      </nav>
    </header>
    <main><Outlet /></main>
    <footer className="footer">
      <div><b>KM 11 Merchandise</b><span>Official ordering portal</span></div>
      <p>Desain terinspirasi palet biru-putih merchandise Kemenkeu Mengajar 11.</p>
    </footer>
  </div>
}
