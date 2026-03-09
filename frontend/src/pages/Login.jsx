import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { LogIn, Eye, EyeOff, Shield } from "lucide-react";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast.error("Please enter email and password");
      return;
    }

    setLoading(true);
    try {
      await login(email, password);
      toast.success("Welcome back!");
      navigate("/admin");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4 relative">
      {/* Admin Login Badge - Bottom Left, same size as Emergent badge */}
      <div className="fixed bottom-4 left-4 z-50">
        <span className="text-sm text-white font-medium bg-[#1a1a1a] h-10 px-4 rounded-full shadow-md flex items-center gap-2">
          <Shield className="w-4 h-4" />
          Admin Login
        </span>
      </div>
      
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <img 
            src="https://customer-assets.emergentagent.com/job_683f7dfb-7860-4882-8d93-58ac3f0439b2/artifacts/jqltfue2_Gemini_Generated_Image_xy33ixy33ixy33ix.png" 
            alt="Thryve Coworking" 
            className="h-20 mx-auto mb-4"
          />
          <h1 className="text-2xl font-bold text-[#2E375B] font-[Manrope]">
            Admin Panel
          </h1>
          <p className="text-slate-500 mt-1">Sign in to manage Thryve Coworking</p>
        </div>

        <Card className="border border-slate-200 shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-center font-[Manrope]">
              Admin Login
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter email"
                  autoComplete="email"
                  data-testid="login-email"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    autoComplete="current-password"
                    data-testid="login-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-[#2E375B] hover:bg-[#232B47]"
                data-testid="login-submit"
              >
                {loading ? (
                  "Signing in..."
                ) : (
                  <>
                    <LogIn className="w-4 h-4 mr-2" />
                    Sign In
                  </>
                )}
              </Button>
              
              <div className="text-center mt-4">
                <button
                  type="button"
                  className="text-sm text-[#2E375B] hover:underline"
                  onClick={() => toast.info("Please contact system administrator to reset your password")}
                >
                  Forgot Password?
                </button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Back to Member Portal */}
        <div className="text-center mt-6">
          <Link 
            to="/" 
            className="text-slate-500 hover:text-slate-700 text-sm inline-flex items-center gap-1"
          >
            ← Back to Member Portal
          </Link>
        </div>
      </div>
    </div>
  );
}
