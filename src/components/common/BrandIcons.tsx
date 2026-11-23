import React from 'react';

interface IconProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
  size?: number;
}

export function GoogleIcon({ className = 'w-4 h-4', size, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size || 18}
      height={size || 18}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
        fill="#EA4335"
      />
    </svg>
  );
}

export function SupabaseIcon({ className = 'w-4 h-4', size, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size || 18}
      height={size || 18}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <path
        d="M13.438 21.688c-.688.875-2.062.375-2.062-.75v-7.375H3.688c-1.125 0-1.688-1.375-.938-2.188L14.062 1.062c.688-.875 2.063-.375 2.063.75v7.376h7.687c1.125 0 1.688 1.375.938 2.187L13.438 21.688z"
        fill="#3ECF8E"
      />
    </svg>
  );
}

export function FirebaseIcon({ className = 'w-4 h-4', size, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size || 18}
      height={size || 18}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <path
        d="M4.664 19.336L7.75 3.125a.8.8 0 0 1 1.488-.184l2.58 4.908L4.664 19.336z"
        fill="#FFA000"
      />
      <path
        d="M4.664 19.336L2.35 14.86a.8.8 0 0 1 .305-1.077l9.163-5.935-7.154 11.488z"
        fill="#F57C00"
      />
      <path
        d="M12.825 21.365a2.5 2.5 0 0 1-1.65 0L4.664 19.336l7.154-11.488 4.417 8.406-3.41 5.111z"
        fill="#FFCA28"
      />
    </svg>
  );
}
