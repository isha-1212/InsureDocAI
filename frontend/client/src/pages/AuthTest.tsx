import { useState } from 'react'
import { authService } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'

export default function AuthTest() {
    const [email, setEmail] = useState('test@example.com')
    const [password, setPassword] = useState('test123456')
    const [role, setRole] = useState<'user' | 'admin'>('user')
    const [result, setResult] = useState<any>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const handleSignUp = async () => {
        setLoading(true)
        setError('')
        setResult(null)
        try {
            const data = await authService.signUp(email, password, role)
            setResult({
                action: 'Sign Up',
                success: true,
                data: {
                    user_id: data.user?.id,
                    email: data.user?.email,
                    token: data.session?.access_token?.substring(0, 50) + '...'
                }
            })
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const handleSignIn = async () => {
        setLoading(true)
        setError('')
        setResult(null)
        try {
            const data = await authService.signIn(email, password)
            setResult({
                action: 'Sign In',
                success: true,
                data: {
                    user_id: data.user?.id,
                    email: data.user?.email,
                    token: data.session?.access_token?.substring(0, 50) + '...'
                }
            })
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const handleGetCurrentUser = async () => {
        setLoading(true)
        setError('')
        setResult(null)
        try {
            // TODO: Use apiClient.getCurrentUser() instead
            const session = await authService.getSession()
            setResult({
                action: 'Get Current User (Supabase Session)',
                success: true,
                data: session?.user
            })
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const handleValidateToken = async () => {
        setLoading(true)
        setError('')
        setResult(null)
        try {
            // TODO: Implement token validation via Django
            const token = authService.getToken()
            setResult({
                action: 'Get Token',
                success: true,
                data: { token: token ? 'Token exists' : 'No token' }
            })
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const handleTestHealth = async () => {
        setLoading(true)
        setError('')
        setResult(null)
        try {
            const response = await fetch('http://localhost:8000/api/auth/health/')
            const data = await response.json()
            setResult({
                action: 'Health Check (Django)',
                success: true,
                data: data
            })
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const handleCreateProfile = async () => {
        setLoading(true)
        setError('')
        setResult(null)
        try {
            // TODO: Use apiClient.registerUser() instead
            const session = await authService.getSession()
            setResult({
                action: 'Create Profile - Use apiClient instead',
                success: false,
                data: { message: 'Method deprecated - use apiClient.registerUser()' }
            })
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const handleSignOut = async () => {
        setLoading(true)
        setError('')
        setResult(null)
        try {
            await authService.signOut()
            setResult({
                action: 'Sign Out',
                success: true,
                data: { message: 'Signed out successfully' }
            })
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="container mx-auto p-8 max-w-4xl">
            <h1 className="text-3xl font-bold mb-8">🧪 Supabase + Django Auth Test</h1>

            <div className="grid gap-6">
                {/* Sign Up/In Section */}
                <Card>
                    <CardHeader>
                        <CardTitle>1. Authentication (Supabase)</CardTitle>
                        <CardDescription>Sign up or sign in to get a JWT token</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-2">
                            <label>Email</label>
                            <Input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="test@example.com"
                            />
                        </div>
                        <div className="grid gap-2">
                            <label>Password</label>
                            <Input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="password"
                            />
                        </div>
                        <div className="grid gap-2">
                            <label>Role</label>
                            <select
                                value={role}
                                onChange={(e) => setRole(e.target.value as 'user' | 'admin')}
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2"
                            >
                                <option value="user">User</option>
                                <option value="admin">Admin</option>
                            </select>
                        </div>
                        <div className="flex gap-2">
                            <Button onClick={handleSignUp} disabled={loading}>
                                Sign Up
                            </Button>
                            <Button onClick={handleSignIn} disabled={loading} variant="secondary">
                                Sign In
                            </Button>
                            <Button onClick={handleSignOut} disabled={loading} variant="destructive">
                                Sign Out
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Django API Tests */}
                <Card>
                    <CardHeader>
                        <CardTitle>2. Django Backend Tests</CardTitle>
                        <CardDescription>Test Django API endpoints with JWT token</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <Button onClick={handleTestHealth} disabled={loading} variant="outline" className="w-full">
                            Test Health Endpoint (No Auth)
                        </Button>
                        <Button onClick={handleValidateToken} disabled={loading} variant="outline" className="w-full">
                            Validate Token
                        </Button>
                        <Button onClick={handleGetCurrentUser} disabled={loading} variant="outline" className="w-full">
                            Get Current User
                        </Button>
                        <Button onClick={handleCreateProfile} disabled={loading} variant="outline" className="w-full">
                            Create User Profile
                        </Button>
                    </CardContent>
                </Card>

                {/* Results Section */}
                {error && (
                    <Alert variant="destructive">
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                {result && (
                    <Card>
                        <CardHeader>
                            <CardTitle>✅ {result.action}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <pre className="bg-slate-100 p-4 rounded overflow-auto text-sm">
                                {JSON.stringify(result.data, null, 2)}
                            </pre>
                        </CardContent>
                    </Card>
                )}

                {/* Instructions */}
                <Card className="bg-blue-50">
                    <CardHeader>
                        <CardTitle>📝 Instructions</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                        <p><strong>1.</strong> Make sure Django server is running: <code className="bg-white px-2 py-1 rounded">python manage.py runserver</code></p>
                        <p><strong>2.</strong> Click "Sign Up" to create a new user (or "Sign In" if already exists)</p>
                        <p><strong>3.</strong> Test Django endpoints to verify JWT authentication</p>
                        <p><strong>4.</strong> Check the results below</p>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
