import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { PackageSearch, ShoppingBag, ShoppingCart, ShieldCheck, Instagram } from 'lucide-react'
import { useCart } from './CartContext'
import { catalogApi } from './api'

export default function Layout() {
  const { count } = useCart()
  const [contact, setContact] = useState<{ instagram: string | null; whatsapp: string | null }>({instagram:null,whatsapp:null})
  useEffect(()=>{catalogApi.contact().then(setContact).catch(()=>undefined)},[])
  return <div className="app-shell">
    <header className="topbar">
      <Link to="/" className="brand" aria-label="Merchandise Kemenkeu Mengajar 11">
        <span className="brand-logo-box"><img src="/brand/merchic-logo.png" alt="Merchic - Merchandise by KM11 DKI Jakarta"/></span>
      </Link>
      <nav className="navlinks">
        <NavLink to="/" end><ShoppingBag size={18}/> Katalog</NavLink>
        <NavLink to="/track"><PackageSearch size={18}/> Lacak</NavLink>
        {contact.instagram ? <a href={contact.instagram} target="_blank" rel="noreferrer"><Instagram size={18}/> Sosial</a> : <a href="#footer-social"><Instagram size={18}/> Sosial</a>}
        <NavLink to="/cart" className="cart-link"><ShoppingCart size={18}/> Keranjang <b>{count}</b></NavLink>
        <NavLink to="/admin"><ShieldCheck size={18}/> Admin</NavLink>
      </nav>
    </header>
    <main><Outlet /></main>
    <footer className="footer" id="footer-social">
      <div className="footer-brand">
        <img src="/brand/merchic-logo.png" alt="Merchic"/>
        <span>Merchandise by KM 11 DKI Jakarta</span>
      </div>
      <p>Merchic • Merchandise Kemenkeu Mengajar 11 {contact.instagram && <a href={contact.instagram} target="_blank" rel="noreferrer"> · Instagram</a>}{contact.whatsapp && <a href={contact.whatsapp} target="_blank" rel="noreferrer"> · WhatsApp</a>}</p>
    </footer>
    {contact.whatsapp && <a className="merchic-whatsapp" href={contact.whatsapp} target="_blank" rel="noreferrer" aria-label="Hubungi Merchic melalui WhatsApp">WhatsApp</a>}
  </div>
}
