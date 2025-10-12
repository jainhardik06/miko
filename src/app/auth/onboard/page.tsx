import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function AuthOnboard(){
  redirect('/auth/signup');
}

