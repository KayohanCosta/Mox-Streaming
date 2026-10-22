import {useEffect,useState} from 'react';
import {Link,Navigate,useParams} from 'react-router-dom';
import {Film} from 'lucide-react';
import Navbar from '@/components/Navbar';
import PageSkeleton from '@/components/PageSkeleton';
import {fetchSourceTitle} from '@/lib/source-catalog';
import {resolveSourceIdentity} from '@/lib/source-identity';
import {CONTENT_UNAVAILABLE_MESSAGE} from '@/lib/redecanais';
export default function SourceDetailsPage(){
 const {id}=useParams();const [target,setTarget]=useState('');const [loading,setLoading]=useState(true);
 useEffect(()=>{let active=true;const c=new AbortController();setLoading(true);setTarget('');fetchSourceTitle(id||'',c.signal).then(resolveSourceIdentity).then(item=>{if(active&&item)setTarget(`/details/${item.media_type}/${item.id}`);}).catch(()=>{}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;c.abort();};},[id]);
 if(loading)return <PageSkeleton/>;
 if(target)return <Navigate to={target} replace/>;
 return <div className="min-h-screen bg-background"><Navbar/><main className="browse-page"><div className="library-empty" role="status"><Film size={35}/><h1>{CONTENT_UNAVAILABLE_MESSAGE}</h1><Link to="/" className="action-secondary">Voltar ao início</Link></div></main></div>;
}
