import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-12">
      <SignIn />
    </div>
  );
}
