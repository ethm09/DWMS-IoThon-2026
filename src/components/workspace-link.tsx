import { Link, useLocation, type LinkProps } from "react-router-dom";
import { workspacePath } from "@/lib/workspace";

export function WorkspaceLink({ to, ...props }: LinkProps) {
  const { pathname } = useLocation();
  return <Link to={typeof to === "string" ? workspacePath(to, pathname) : to} {...props} />;
}
