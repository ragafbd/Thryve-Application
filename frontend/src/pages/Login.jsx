import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { LogIn, Eye, EyeOff, Shield, Users } from "lucide-react";

export default function Login() {
  const navigate = useNavigate();
  const { login, user, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (!loading && user) {
      navigate("/admin");
    }
  }, [user, loading, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast.error("Please enter email and password");
      return;
    }

    setSubmitting(true);
    try {
      await login(email, password);
      toast.success("Welcome back!");
      navigate("/admin");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Login failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#1E2640] flex items-center justify-center p-4 relative">
      {/* Decorative background pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-0 left-0 w-full h-full" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }} />
      </div>
      
      {/* Member Portal Link - Bottom Left */}
      <Link to="/" className="fixed bottom-4 left-4 z-50">
        <span className="text-sm text-[#1E2640] font-medium bg-white h-10 px-4 rounded-full shadow-md flex items-center gap-2 hover:bg-gray-100 transition-colors">
          <Users className="w-4 h-4" />
          Member Portal
        </span>
      </Link>
      
      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <img 
            src="https://customer-assets.emergentagent.com/job_683f7dfb-7860-4882-8d93-58ac3f0439b2/artifacts/jqltfue2_Gemini_Generated_Image_xy33ixy33ixy33ix.png" 
            alt="Thryve Coworking" 
            className="h-20 mx-auto mb-4"
          />
          <div className="inline-flex items-center gap-2 bg-amber-500/20 text-amber-300 px-4 py-1.5 rounded-full text-sm font-medium mb-3">
            <Shield className="w-4 h-4" />
            Admin Access Only
          </div>
          <h1 className="text-2xl font-bold text-white font-[Manrope]">
            Admin Panel
          </h1>
          <p className="text-slate-400 mt-1">Sign in to manage Thryve Coworking</p>
        </div>

        <Card className="border-0 shadow-2xl bg-white/95 backdrop-blur">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold text-center font-[Manrope] text-[#1E2640]">
              Administrator Login
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-[#1E2640]">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@thryve.in"
                  autoComplete="email"
                  data-testid="login-email"
                  className="border-slate-300 focus:border-[#1E2640] focus:ring-[#1E2640]"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-[#1E2640]">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    autoComplete="current-password"
                    data-testid="login-password"
                    className="pr-10 border-slate-300 focus:border-[#1E2640] focus:ring-[#1E2640]"
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
                className="w-full bg-[#1E2640] hover:bg-[#2E375B] text-white font-medium"
                disabled={submitting}
                data-testid="login-submit"
              >
                {submitting ? (
                  "Signing in..."
                ) : (
                  <>
                    <LogIn className="w-4 h-4 mr-2" />
                    Sign In
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-slate-500 text-sm mt-6">
          Thryve Coworking Management System
        </p>
      </div>
    </div>
  );
}
