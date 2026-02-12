import { Navigate, useParams } from 'react-router-dom'

export default function ChatThread() {
  const { conversationId } = useParams()

  if (!conversationId) {
    return <Navigate to="/chats" replace />
  }

  return <Navigate to={`/chats?c=${conversationId}`} replace />
}
