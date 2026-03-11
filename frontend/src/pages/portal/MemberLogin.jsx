import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Building2, Mail, Lock, Eye, EyeOff, UserPlus, LogIn, Shield } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useMemberAuth } from "@/contexts/MemberAuthContext";

export default function MemberLogin() {
  const navigate = useNavigate();
  const { login, register, member, loading: authLoading } = useMemberAuth();
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [activeTab, setActiveTab] = useState("login");

  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [registerData, setRegisterData] = useState({ email: "", password: "", confirmPassword: "" });

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && member) {
      navigate("/portal");
    }
  }, [member, authLoading, navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!loginData.email || !loginData.password) {
      toast.error("Please fill in all fields");
      return;
    }

    setSubmitting(true);
    try {
      await login(loginData.email, loginData.password);
      toast.success("Welcome back!");
      navigate("/portal");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Login failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!registerData.email || !registerData.password || !registerData.confirmPassword) {
      toast.error("Please fill in all fields");
      return;
    }
    if (registerData.password !== registerData.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (registerData.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    try {
      const result = await register(registerData.email, registerData.password);
      toast.success(result.message);
      setActiveTab("login");
      setLoginData({ email: registerData.email, password: "" });
    } catch (error) {
      toast.error(error.response?.data?.detail || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4 relative">
      {/* Admin Login Badge - Bottom Left, same style as Emergent badge */}
      <Link to="/admin/login" className="fixed bottom-4 left-4 z-50">
        <span className="text-sm text-white font-medium bg-[#1a1a1a] h-10 px-4 rounded-full shadow-md flex items-center gap-2 hover:bg-[#333] transition-colors">
          <Shield className="w-4 h-4" />
          Admin Login
        </span>
      </Link>
      
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <img 
            src="https://customer-assets.emergentagent.com/job_683f7dfb-7860-4882-8d93-58ac3f0439b2/artifacts/jqltfue2_Gemini_Generated_Image_xy33ixy33ixy33ix.png" 
            alt="Thryve Coworking" 
            className="h-20 mx-auto mb-4"
          />
          <h1 className="text-3xl font-bold text-[#2E375B] font-[Manrope]">Manage your World</h1>
          <p className="text-[#2E375B]/60 mt-2">Member Portal - Access your invoices, bookings & support</p>
        </div>

        <Card className="border border-[#2E375B]/10 shadow-lg">
          <CardContent className="p-6">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="login" className="flex items-center gap-2">
                  <LogIn className="w-4 h-4" />
                  Login
                </TabsTrigger>
                <TabsTrigger value="register" className="flex items-center gap-2">
                  <UserPlus className="w-4 h-4" />
                  Register
                </TabsTrigger>
              </TabsList>

              {/* Login Form */}
              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="your@email.com"
                        className="pl-10"
                        value={loginData.email}
                        onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                        data-testid="member-login-email"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        id="login-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter your password"
                        className="pl-10 pr-10"
                        value={loginData.password}
                        onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                        data-testid="member-login-password"
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
                    className="w-full bg-[#2E375B] hover:bg-[#232B47]"
                    disabled={submitting}
                    data-testid="member-login-submit"
                  >
                    {submitting ? "Signing in..." : "Sign In"}
                  </Button>
                  <div className="text-center">
                    <button
                      type="button"
                      className="text-sm text-[#2E375B] hover:underline"
                      onClick={() => toast.info("Please contact Thryve admin to reset your password")}
                    >
                      Forgot Password?
                    </button>
                  </div>
                </form>
              </TabsContent>

              {/* Register Form */}
              <TabsContent value="register">
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-700 mb-4">
                    <strong>Note:</strong> Your email must match your Thryve membership record.
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        id="register-email"
                        type="email"
                        placeholder="your@email.com"
                        className="pl-10"
                        value={registerData.email}
                        onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                        data-testid="member-register-email"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        id="register-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Min 6 characters"
                        className="pl-10"
                        value={registerData.password}
                        onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                        data-testid="member-register-password"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-confirm">Confirm Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        id="register-confirm"
                        type={showPassword ? "text" : "password"}
                        placeholder="Confirm password"
                        className="pl-10"
                        value={registerData.confirmPassword}
                        onChange={(e) => setRegisterData({ ...registerData, confirmPassword: e.target.value })}
                        data-testid="member-register-confirm"
                      />
                    </div>
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-[#FFA14A] hover:bg-[#e8893a] text-white"
                    disabled={loading}
                    data-testid="member-register-submit"
                  >
                    {loading ? "Creating account..." : "Create Account"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
