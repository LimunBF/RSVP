import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import Public from './invitation';
import { Ornament, Spinner } from './ui';
import './styles.css';

// The invitation is what every guest opens. The organizer desk and check-in desk load only when routed to.
const Auth = lazy(() => import('./admin').then(module => ({ default: module.Auth })));
const Dashboard = lazy(() => import('./admin').then(module => ({ default: module.Dashboard })));
const CheckInPage = lazy(() => import('./admin').then(module => ({ default: module.CheckInPage })));

function Fallback() { return <main className="public-state"><div><Ornament/><Spinner/></div></main>; }

function App() {
  return <Suspense fallback={<Fallback/>}>
    <Routes>
      <Route path="/check-in/:slug" element={<CheckInPage/>}/>
      <Route path="/w/:slug/check-in" element={<CheckInPage/>}/>
      <Route path="/w/:slug" element={<Public/>}/>
      <Route path="/login" element={<Auth mode="login"/>}/>
      <Route path="/register" element={<Auth mode="register"/>}/>
      <Route path="/dashboard" element={<Dashboard/>}/>
      <Route path="*" element={<Navigate to="/login"/>}/>
    </Routes>
  </Suspense>;
}

createRoot(document.getElementById('root')!).render(<StrictMode><BrowserRouter><App/></BrowserRouter></StrictMode>);
