import { redirect } from 'next/navigation'

export default function TopRatedPage() {
  redirect('/restaurants?tab=top')
}
