import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import AppLayout from './layouts/AppLayout'
import AuthLayout from './layouts/AuthLayout'
import RootLayout from './layouts/RootLayout'
import Dashboard from './pages/Dashboard'
import Events from './pages/Events'
import Groups from './pages/Groups'
import Login from './pages/Login'
import Marketplace from './pages/Marketplace'
import MarketplaceCreate from './pages/MarketplaceCreate'
import MarketplaceDetail from './pages/MarketplaceDetail'
import Notes from './pages/Notes'
import NotFound from './pages/NotFound'
import Onboarding from './pages/Onboarding'
import Profile from './pages/Profile'
import ProfileEdit from './pages/ProfileEdit'
import Signup from './pages/Signup'
import Wanted from './pages/Wanted'
import WantedCreate from './pages/WantedCreate'
import WantedDetail from './pages/WantedDetail'
import Verification from './pages/Verification'
import ProtectedRoute from './routes/ProtectedRoute'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AuthLayout />}>
          <Route index element={<Login />} />
          <Route path="login" element={<Login />} />
          <Route path="signup" element={<Signup />} />
        </Route>
        <Route element={<ProtectedRoute />}>
          <Route element={<RootLayout />}>
            <Route path="onboarding" element={<Onboarding />} />
          </Route>
          <Route element={<AppLayout />}>
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="app" element={<Navigate to="/dashboard" replace />} />
            <Route path="marketplace" element={<Marketplace />} />
            <Route path="marketplace/new" element={<MarketplaceCreate />} />
            <Route
              path="marketplace/:listingId"
              element={<MarketplaceDetail />}
            />
            <Route path="wanted" element={<Wanted />} />
            <Route path="wanted/new" element={<WantedCreate />} />
            <Route path="wanted/:wantedId" element={<WantedDetail />} />
            <Route path="groups" element={<Groups />} />
            <Route path="notes" element={<Notes />} />
            <Route path="events" element={<Events />} />
            <Route path="profile" element={<Profile />} />
            <Route path="profile/edit" element={<ProfileEdit />} />
            <Route path="verification" element={<Verification />} />
          </Route>
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
