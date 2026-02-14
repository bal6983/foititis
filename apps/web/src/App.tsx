import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import AppLayout from './layouts/AppLayout'
import AuthLayout from './layouts/AuthLayout'
import RootLayout from './layouts/RootLayout'
import Dashboard from './pages/Dashboard'
import Events from './pages/Events'
import Groups from './pages/Groups'
import Login from './pages/Login'
import Marketplace from './pages/Marketplace'
import MarketplaceDetail from './pages/MarketplaceDetail'
import Notes from './pages/Notes'
import NotFound from './pages/NotFound'
import Onboarding from './pages/Onboarding'
import OnboardingConfirm from './pages/OnboardingConfirm'
import Profile from './pages/Profile'
import ProfileEdit from './pages/ProfileEdit'
import PublicProfile from './pages/PublicProfile'
import ChatThread from './pages/ChatThread'
import Chats from './pages/Chats'
import AuthCallback from './pages/AuthCallback'
import Signup from './pages/Signup'
import Students from './pages/Students'
import Universities from './pages/Universities'
import Saved from './pages/Saved'
import WantedDetail from './pages/WantedDetail'
import Verification from './pages/Verification'
import ProtectedRoute from './routes/ProtectedRoute'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AuthLayout />}>
          <Route path="auth/callback" element={<AuthCallback />} />
          <Route index element={<Login />} />
          <Route path="login" element={<Login />} />
          <Route path="signup" element={<Signup />} />
        </Route>
        <Route element={<ProtectedRoute />}>
          <Route element={<RootLayout />}>
            <Route path="onboarding" element={<Onboarding />} />
            <Route path="onboarding-confirm" element={<OnboardingConfirm />} />
          </Route>
          <Route element={<AppLayout />}>
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="app" element={<Navigate to="/dashboard" replace />} />
            <Route path="marketplace" element={<Marketplace />} />
            <Route
              path="marketplace/new"
              element={<Navigate to="/marketplace?create=sell" replace />}
            />
            <Route
              path="marketplace/:listingId"
              element={<MarketplaceDetail />}
            />
            <Route
              path="wanted"
              element={<Navigate to="/marketplace?view=want" replace />}
            />
            <Route
              path="wanted/new"
              element={<Navigate to="/marketplace?create=want" replace />}
            />
            <Route path="wanted/:wantedId" element={<WantedDetail />} />
            <Route path="groups" element={<Groups />} />
            <Route path="notes" element={<Notes />} />
            <Route path="events" element={<Events />} />
            <Route path="saved" element={<Saved />} />
            <Route path="profile" element={<Profile />} />
            <Route path="profile/edit" element={<ProfileEdit />} />
            <Route path="/profile/:id" element={<PublicProfile />} />
            <Route path="/chat/:conversationId" element={<ChatThread />} />
            <Route path="chats" element={<Chats />} />
            <Route path="students" element={<Students />} />
            <Route path="universities" element={<Universities />} />
            <Route path="verification" element={<Verification />} />
          </Route>
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
