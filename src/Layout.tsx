import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { PackageSearch, ShoppingBag, ShoppingCart, ShieldCheck, Instagram, MessageCircle } from 'lucide-react'
import { useCart } from './CartContext'
import { catalogApi } from './api'
import { DEFAULT_CONTACT } from './contact'

export default function Layout() {
  const { count } = useCart()
  const [contact, setContact] = useState<{ instagram: string | null; whatsapp: string | null }>(DEFAULT_CONTACT)
  useEffect(()=>{catalogApi.contact().then(v => setContact({ instagram: v.instagram || DEFAULT_CONTACT.instagram, whatsapp: v.whatsapp || DEFAULT_CONTACT.whatsapp })).catch(()=>undefined)},[])
  const instagramHandle = contact.instagram?.match(/instagram\.com\/([a-zA-Z0-9._]+)/)?.[1] || 'km_dkijakarta'
  const whatsappDigits = contact.whatsapp?.match(/wa\.me\/(\d+)/)?.[1] || '628113446578'
  const whatsappLabel = whatsappDigits === '628113446578' ? '+62 811-3446-578' : `+${whatsappDigits}`
  return <div className="app-shell">
    <header className="topbar">
      <Link to="/" className="brand" aria-label="Merchandise Kemenkeu Mengajar 11">
        <span className="brand-logo-box"><img src="/brand/merchic-logo.png" alt="Merchic - Merchandise by KM11 DKI Jakarta"/></span>
      </Link>
      <nav className="navlinks">
        <NavLink to="/" end><ShoppingBag size={18}/> Katalog</NavLink>
        <NavLink to="/track"><PackageSearch size={18}/> Lacak</NavLink>
        {contact.instagram && <a href={contact.instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram KM DKI Jakarta"><Instagram size={18}/> Instagram</a>}
        {contact.whatsapp && <a href={contact.whatsapp} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp customer service Merchic"><MessageCircle size={18}/> WhatsApp</a>}
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
      <div className="merchic-contact-links" aria-label="Kontak resmi Merchic">
        {contact.instagram && <a href={contact.instagram} target="_blank" rel="noopener noreferrer"><Instagram size={17}/> Instagram @{instagramHandle}</a>}
        {contact.whatsapp && <a href={contact.whatsapp} target="_blank" rel="noopener noreferrer"><MessageCircle size={17}/> WhatsApp {whatsappLabel}</a>}
      </div>
    </footer>
    {contact.whatsapp && <a className="merchic-whatsapp" href={contact.whatsapp} target="_blank" rel="noopener noreferrer" aria-label="Hubungi Merchic melalui WhatsApp"><MessageCircle size={19}/> Chat WhatsApp</a>}
  </div>
}
