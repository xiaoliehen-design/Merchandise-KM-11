import { Link, NavLink, Outlet } from 'react-router-dom'
import { PackageSearch, ShoppingBag, ShoppingCart, ShieldCheck } from 'lucide-react'
import { useCart } from './CartContext'

export default function Layout() {
  const { count } = useCart()
  return <div className="app-shell">
    <header className="topbar">
      <Link to="/" className="brand" aria-label="Merchandise Kemenkeu Mengajar 11">
        <span className="brand-logo-box"><img src="/brand/km11-logo-white.png" alt="Kemenkeu Mengajar 11"/></span>
        <span className="brand-copy"><strong>Merchandise</strong><small>Official ordering portal</small></span>
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
      <div className="footer-brand">
        <img src="/brand/km11-logo-blue.png" alt="Kemenkeu Mengajar 11"/>
        <span>Portal pemesanan merchandise resmi KM11</span>
      </div>
      <p>Merchandise Kemenkeu Mengajar 11 • Ceria, rapi, dan mudah dipesan.</p>
    </footer>
  </div>
}
