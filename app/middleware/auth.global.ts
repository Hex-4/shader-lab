export default defineNuxtRouteMiddleware((to) => {
  // Public routes
  if (to.path === "/login") return;
  if (to.path.startsWith("/c/")) return;
  if (to.path.startsWith("/gradient-dither")) return;

  const { loggedIn } = useUserSession();

  if (!loggedIn.value) {
    return navigateTo("/login");
  }
});
