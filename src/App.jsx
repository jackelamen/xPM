import { Routes, Route, Navigate, useSearchParams } from "react-router-dom";
import Layout from "./pages/Layout";
import { Toaster } from "react-hot-toast";
import Dashboard from "./pages/Dashboard";
import MyTasks from "./pages/MyTasks";
import AllTasks from "./pages/AllTasks";
import Projects from "./pages/Projects";
import Team from "./pages/Team";
import ProjectDetails from "./pages/ProjectDetails";
import ProfileSettings from "./pages/ProfileSettings";
import CRM from "./pages/CRM";
import XPlan from "./pages/XPlan";
import Workload from "./pages/Workload";
import Spaces from "./pages/Spaces";
import SpaceDashboard from "./pages/SpaceDashboard";
import AcceptInvite from "./pages/AcceptInvite";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import Archive from "./pages/Archive";
import { useAuth } from "./context/AuthContext";
import { Loader2Icon } from "lucide-react";

const ProtectedRoute = ({ children }) => {
    const { user, loading } = useAuth()

    if (loading) return (
        <div className="flex items-center justify-center h-screen bg-white dark:bg-zinc-950">
            <Loader2Icon className="size-7 text-blue-500 animate-spin" />
        </div>
    )

    if (!user) return <Navigate to="/login" replace />

    return children
}

/**
 * Legacy `/taskDetails` links (older notification emails, pushes and bookmarks
 * predate the `/projectsDetail` route) used to be redirected to `/projects`,
 * which silently dropped their params and dumped the reader on the all-projects
 * list with no idea why. Forward the params instead so the task still opens.
 */
const LegacyTaskDetailsRedirect = () => {
    const [params] = useSearchParams()
    const projectId = params.get('id') || params.get('projectId') || params.get('project')
    const taskId = params.get('task') || params.get('taskId')

    // Without a project there is nothing for ProjectDetails to resolve.
    if (!projectId) return <Navigate to="/projects" replace />

    const next = new URLSearchParams({ id: projectId, tab: params.get('tab') || 'tasks' })
    if (taskId) next.set('task', taskId)

    return <Navigate to={`/projectsDetail?${next.toString()}`} replace />
}

const App = () => {
    return (
        <>
            <Toaster />
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/accept-invite" element={<AcceptInvite />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/" element={
                    <ProtectedRoute>
                        <Layout />
                    </ProtectedRoute>
                }>
                    <Route index element={<Dashboard />} />
                    <Route path="my-tasks" element={<MyTasks />} />
                    <Route path="all-tasks" element={<AllTasks />} />
                    <Route path="team" element={<Team />} />
                    <Route path="spaces" element={<Spaces />} />
                    <Route path="spaces/:spaceId" element={<SpaceDashboard />} />
                    <Route path="projects" element={<Projects />} />
                    <Route path="projectsDetail" element={<ProjectDetails />} />
                    <Route path="taskDetails" element={<LegacyTaskDetailsRedirect />} />
                    <Route path="settings" element={<ProfileSettings />} />
                    <Route path="crm" element={<CRM />} />
                    <Route path="xplan" element={<XPlan />} />
                    <Route path="workload" element={<Workload />} />
                    <Route path="archive" element={<Archive />} />
                </Route>
            </Routes>
        </>
    );
};

export default App;
