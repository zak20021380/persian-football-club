import { Link } from 'react-router-dom';
import { Card } from '@/components/ui';
export function NotFoundPage(){return <main className="safe-top flex min-h-screen items-center p-4"><Card className="mx-auto w-full max-w-md text-center"><div className="text-5xl font-black text-pitch-300">۴۰۴</div><h1 className="mt-4 text-xl font-black">این صفحه خارج از زمین است!</h1><p className="mt-2 text-sm text-slate-400">مسیر موردنظر پیدا نشد.</p><Link to="/" className="btn-primary mt-5 w-full">بازگشت به خانه</Link></Card></main>}
