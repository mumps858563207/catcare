import React, { useState, useEffect, Component, ErrorInfo, ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Heart, 
  ShieldCheck, 
  BookOpen, 
  Star, 
  ChevronRight, 
  Menu, 
  X, 
  Cat, 
  Sparkles,
  ArrowRight,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { db, collection, onSnapshot, query, orderBy } from './firebase';

// Error Boundary Component
interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-brand-cream p-6">
          <div className="bg-white p-8 rounded-brand shadow-xl max-w-md w-full text-center border-t-4 border-brand-orange">
            <AlertCircle size={48} className="text-brand-orange mx-auto mb-4" />
            <h2 className="text-2xl font-sans font-bold mb-4 text-brand-ink">哎呀！出錯了</h2>
            <p className="text-gray-600 mb-6">
              應用程式發生了一些問題。請嘗試重新整理頁面。
            </p>
            <button 
              onClick={() => window.location.reload()}
              className="bg-brand-orange text-white px-6 py-2 rounded-brand font-bold hover:shadow-lg transition-all"
            >
              重新整理
            </button>
            {process.env.NODE_ENV === 'development' && (
              <pre className="mt-6 p-4 bg-gray-100 rounded text-left text-xs overflow-auto max-h-40">
                {this.state.error?.message}
              </pre>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Firestore Error Handler
enum OperationType {
  GET = 'get',
  WRITE = 'write',
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Initialize Gemini for the "Automation" demo
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

const COLORS = {
  cream: '#FDFBF7',
  peach: '#FFE5D9',
  sage: '#B7B7A4',
  orange: '#FF8C42',
  ink: '#2D2D2D'
};

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

function AppContent() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [academyArticles, setAcademyArticles] = useState<any[]>([]);
  const [reviewArticles, setReviewArticles] = useState<any[]>([]);
  const [loadingArticles, setLoadingArticles] = useState(true);
  const [loadingReviews, setLoadingReviews] = useState(true);

  const DEFAULT_ARTICLES = [
    { tag: "健康", title: "貓咪換季掉毛怎麼辦？五個居家護理小撇步", image: "https://picsum.photos/seed/cat-care-1/400/300", description: "換季護理指南", link: "#" },
    { tag: "行為", title: "為什麼貓咪喜歡推倒桌上的東西？專家解密", image: "https://picsum.photos/seed/cat-care-2/400/300", description: "行為學解析", link: "#" },
    { tag: "飲食", title: "全濕食還是半濕食？找出最適合你家貓咪的方案", image: "https://picsum.photos/seed/cat-care-3/400/300", description: "營養學建議", link: "#" },
    { tag: "環境", title: "小坪數也能打造貓咪天堂：垂直空間利用指南", image: "https://picsum.photos/seed/cat-care-4/400/300", description: "空間設計靈感", link: "#" }
  ];

  const DEFAULT_REVIEWS = [
    { 
      tag: "熱門測評", 
      title: "Furbo 360° Dog Camera 深度評測：2026 實測優缺點與避坑指南", 
      image: "https://m.media-amazon.com/images/I/71TNkx-2eeL._AC_UL320_.jpg", 
      description: "這款專為寵物設計的攝影機真的好用嗎？我們針對連線穩定度、夜視功能以及丟零食互動進行了為期一個月的實測...", 
      link: "https://mumpsaiweb.zeabur.app/furbo-360-dog-camera-%e6%b7%b1%e5%ba%a6%e8%a9%95%e6%b8%ac/" 
    },
    { 
      tag: "專業測評", 
      title: "Roborock S8 Pro Ultra 掃地機器人 深度評測：2026 實測優缺點與避坑指南", 
      image: "https://picsum.photos/seed/review-2/800/450", 
      description: "家有毛小孩，掃地機器人是必備嗎？Roborock S8 Pro Ultra 的自動清洗與烘乾功能是否能應對貓毛大軍？", 
      link: "https://mumpsaiweb.zeabur.app/roborock-s8-pro-ultra-%e6%8e%83%e5%9c%b0%e6%a9%9f%e5%99%a8%e4%ba%ba-%e6%b7%b1%e5%ba%a6%e8%a9%95%e6%b8%ac/" 
    }
  ];

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // 輔助函數：從 HTML 內容中抓取第一張圖片的 URL
  const getFirstImageFromContent = (html: string) => {
    const div = document.createElement('div');
    div.innerHTML = html;
    const img = div.querySelector('img');
    return img ? img.src : null;
  };

  useEffect(() => {
    const fetchWordPressData = async () => {
      try {
        // 1. 同時抓取所有分類
        const catResponse = await fetch('https://mumpsaiweb.zeabur.app/wp-json/wp/v2/categories?per_page=100');
        if (!catResponse.ok) throw new Error('無法取得分類資訊');
        const categories = await catResponse.json();
        
        // 尋找分類
        const academyCat = categories.find((c: any) => c.name.includes('小學堂') || c.slug.includes('小學堂'));
        const reviewCat = categories.find((c: any) => c.name.includes('專業測評') || c.slug.includes('專業測評'));

        // 2. 抓取小學堂文章
        if (academyCat) {
          const res = await fetch(`https://mumpsaiweb.zeabur.app/wp-json/wp/v2/posts?_embed&per_page=4&categories=${academyCat.id}&status=publish`);
          if (res.ok) {
            const data = await res.json();
            if (data.length > 0) {
              setAcademyArticles(data.map((post: any) => ({
                id: post.id,
                title: post.title.rendered,
                tag: '小學堂',
                description: post.excerpt.rendered.replace(/<[^>]*>?/gm, '').substring(0, 50) + '...',
                image: post._embedded?.['wp:featuredmedia']?.[0]?.source_url || getFirstImageFromContent(post.content.rendered) || `https://picsum.photos/seed/wp-${post.id}/400/300`,
                link: post.link
              })));
            }
          }
        }
        setLoadingArticles(false);

        // 3. 抓取專業測評文章
        if (reviewCat) {
          const res = await fetch(`https://mumpsaiweb.zeabur.app/wp-json/wp/v2/posts?_embed&per_page=2&categories=${reviewCat.id}&status=publish`);
          if (res.ok) {
            const data = await res.json();
            if (data.length > 0) {
              setReviewArticles(data.map((post: any) => ({
                id: post.id,
                title: post.title.rendered,
                tag: '專業測評',
                description: post.excerpt.rendered.replace(/<[^>]*>?/gm, '').substring(0, 100) + '...',
                image: post._embedded?.['wp:featuredmedia']?.[0]?.source_url || getFirstImageFromContent(post.content.rendered) || `https://picsum.photos/seed/review-${post.id}/800/450`,
                link: post.link
              })));
            }
          }
        }
        setLoadingReviews(false);

      } catch (error) {
        console.error('WordPress Fetch Error:', error);
        setLoadingArticles(false);
        setLoadingReviews(false);
      }
    };

    fetchWordPressData();
  }, []);

  const displayArticles = academyArticles.length > 0 ? academyArticles : DEFAULT_ARTICLES;
  const displayReviews = reviewArticles.length > 0 ? reviewArticles : DEFAULT_REVIEWS;

  return (
    <div className="min-h-screen bg-brand-cream font-serif selection:bg-brand-peach selection:text-brand-ink">
      {/* Navigation */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white/80 backdrop-blur-md shadow-sm py-3' : 'bg-transparent py-6'}`}>
        <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
          <div className="flex items-center gap-2 group cursor-pointer">
            <div className="w-10 h-10 bg-brand-orange rounded-brand flex items-center justify-center text-white transition-transform group-hover:rotate-12">
              <Cat size={24} />
            </div>
            <span className="font-sans font-bold text-xl tracking-tight text-brand-ink">Mumps Cat Care</span>
          </div>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8 font-sans font-medium text-sm uppercase tracking-wider">
            <a href="#why" className="hover:text-brand-orange transition-colors">為什麼選擇我們</a>
            <a href="#reviews" className="hover:text-brand-orange transition-colors">專業測評</a>
            <a href="#academy" className="hover:text-brand-orange transition-colors">貓奴小學堂</a>
            <a 
              href="https://mumpsaiweb.zeabur.app/category/%e7%94%a2%e5%93%81/"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-brand-orange text-white px-6 py-2.5 rounded-brand font-bold hover:shadow-lg hover:shadow-brand-orange/20 transition-all active:scale-95 text-center"
            >
              立即選購
            </a>
          </div>

          {/* Mobile Toggle */}
          <button className="md:hidden text-brand-ink" onClick={() => setIsMenuOpen(!isMenuOpen)}>
            {isMenuOpen ? <X size={28} /> : <Menu size={28} />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed inset-0 z-40 bg-white pt-24 px-6 md:hidden"
          >
            <div className="flex flex-col gap-6 font-sans font-bold text-2xl">
              <a href="#why" onClick={() => setIsMenuOpen(false)}>為什麼選擇我們</a>
              <a href="#reviews" onClick={() => setIsMenuOpen(false)}>專業測評</a>
              <a href="#academy" onClick={() => setIsMenuOpen(false)}>貓奴小學堂</a>
              <a 
                href="https://mumpsaiweb.zeabur.app/category/%e7%94%a2%e5%93%81/"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setIsMenuOpen(false)}
                className="bg-brand-orange text-white py-4 rounded-brand mt-4 text-center"
              >
                立即選購
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-brand-peach rounded-full text-brand-orange font-sans font-bold text-xs uppercase tracking-widest mb-6">
              <Sparkles size={14} />
              <span>Premium Cat Supplies</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-sans font-bold leading-[1.1] mb-6 text-brand-ink">
              給貓咪最好的，<br />
              <span className="text-brand-sage italic font-serif font-normal">給貓奴最懂的。</span>
            </h1>
            <p className="text-lg md:text-xl text-gray-600 mb-10 max-w-lg leading-relaxed">
              我們不只是在賣商品，而是在傳遞一份對生命的尊重。每一件選品都經過行為學專家的嚴格把關，只為讓你的貓咪活得更快樂、更優雅。
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <a 
                href="https://mumpsaiweb.zeabur.app/category/%e7%94%a2%e5%93%81/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="bg-brand-orange text-white px-8 py-4 rounded-brand font-sans font-bold text-lg flex items-center justify-center gap-2 hover:shadow-xl hover:shadow-brand-orange/30 transition-all active:scale-95"
              >
                探索精選系列 <ChevronRight size={20} />
              </a>
              <button className="border-2 border-brand-sage text-brand-sage px-8 py-4 rounded-brand font-sans font-bold text-lg hover:bg-brand-sage hover:text-white transition-all">
                了解我們的標準
              </button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: 0.2 }}
            className="relative"
          >
            <div className="aspect-[4/5] rounded-brand overflow-hidden shadow-2xl relative z-10">
              <img 
                src="https://mumpsaiweb.zeabur.app/wp-content/uploads/2026/03/Gemini_Generated_Image_iq1hbkiq1hbkiq1h.png" 
                alt="Mumps Cat Care Hero" 
                className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
            </div>
            {/* Decorative Elements */}
            <div className="absolute -top-6 -right-6 w-32 h-32 bg-brand-peach rounded-full -z-0 blur-2xl opacity-60"></div>
            <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-brand-sage/20 rounded-full -z-0 blur-3xl"></div>
            
            <div className="absolute bottom-8 -left-8 bg-white p-6 rounded-brand shadow-xl z-20 hidden lg:block max-w-[200px]">
              <div className="flex gap-1 mb-2">
                {[1,2,3,4,5].map(i => <Star key={i} size={14} fill={COLORS.orange} color={COLORS.orange} />)}
              </div>
              <p className="text-xs font-sans font-medium text-gray-500 italic">
                "這是我買過最有質感的貓抓板，主子愛不釋手！"
              </p>
              <p className="text-[10px] font-sans font-bold mt-2 uppercase tracking-widest">— 台北 林小姐</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Why Us Section */}
      <section id="why" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-20">
            <h2 className="text-3xl md:text-5xl font-sans font-bold mb-6">為什麼選擇 Mumps Cat Care？</h2>
            <p className="text-gray-600 text-lg">
              看到貓咪無聊拆家，我們也和你一樣心疼。我們相信，正確的玩具與用品能顯著改善貓咪的行為問題，讓居家生活更和諧。
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: <Heart className="text-brand-orange" />,
                title: "同理心切入",
                desc: "我們從貓咪的視角出發，理解牠們的狩獵天性與安全需求。"
              },
              {
                icon: <ShieldCheck className="text-brand-orange" />,
                title: "專業材質把關",
                desc: "100% 無毒環保材質，通過歐盟安全認證，耐咬耐抓更耐用。"
              },
              {
                icon: <Sparkles className="text-brand-orange" />,
                title: "行為學設計",
                desc: "結合貓咪行為學，設計出能激發智力與體力的互動式產品。"
              }
            ].map((item, idx) => (
              <motion.div 
                key={idx}
                whileHover={{ y: -10 }}
                className="p-10 bg-brand-cream rounded-brand border border-brand-peach transition-all"
              >
                <div className="w-14 h-14 bg-white rounded-brand flex items-center justify-center mb-6 shadow-sm">
                  {item.icon}
                </div>
                <h3 className="text-xl font-sans font-bold mb-4">{item.title}</h3>
                <p className="text-gray-600 leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Expert Reviews Section */}
      <section id="reviews" className="py-24 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-6">
            <div className="max-w-2xl">
              <h2 className="text-3xl md:text-5xl font-sans font-bold mb-6">專業測評區</h2>
              <p className="text-gray-600 text-lg">
                每一款推薦產品都經過我們的「貓咪測試員」實測 30 天，並由行為分析師撰寫深度報告。
              </p>
            </div>
            <a 
              href="https://mumpsaiweb.zeabur.app/category/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-brand-orange font-sans font-bold flex items-center gap-2 hover:gap-4 transition-all"
            >
              查看所有報告 <ArrowRight size={20} />
            </a>
          </div>

          <div className="grid md:grid-cols-2 gap-12">
            {displayReviews.map((review, idx) => (
              <a 
                key={review.id || idx}
                href={review.link || "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="group cursor-pointer block"
              >
                <div className="aspect-video rounded-brand overflow-hidden mb-6 relative">
                  <img 
                    src={review.image} 
                    alt={review.title} 
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute top-4 left-4 bg-white/90 backdrop-blur px-3 py-1 rounded-full text-[10px] font-sans font-bold uppercase tracking-widest">
                    {review.tag}
                  </div>
                </div>
                <h3 className="text-2xl font-sans font-bold mb-3 group-hover:text-brand-orange transition-colors">
                  {review.title}
                </h3>
                <p className="text-gray-600 line-clamp-2">
                  {review.description}
                </p>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Trust Statement */}
      <section className="py-24 bg-brand-sage/10">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="inline-block p-4 bg-white rounded-full mb-8 shadow-sm">
            <ShieldCheck size={48} className="text-brand-sage" />
          </div>
          <h2 className="text-3xl font-sans font-bold mb-8">我們如何挑選每一件玩具？</h2>
          <div className="bg-white p-10 rounded-brand shadow-xl text-left border-t-4 border-brand-orange">
            <p className="text-lg leading-relaxed text-gray-700 italic mb-8">
              「在 Mumps Cat Care，安全性是我們不可逾越的底線。我們拒絕任何含有塑化劑、劣質染料或易脫落小零件的產品。每一件選品都必須通過『行為激發度』、『材質安全性』與『貓咪喜愛度』三大指標的考核。我們不僅懂產品，我們更懂貓。」
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 text-sm font-sans font-bold text-brand-ink">
                <CheckCircle2 size={18} className="text-brand-orange" />
                <span>100% 無毒環保認證</span>
              </div>
              <div className="flex items-center gap-3 text-sm font-sans font-bold text-brand-ink">
                <CheckCircle2 size={18} className="text-brand-orange" />
                <span>行為分析師親自實測</span>
              </div>
              <div className="flex items-center gap-3 text-sm font-sans font-bold text-brand-ink">
                <CheckCircle2 size={18} className="text-brand-orange" />
                <span>7 天無條件貓咪試用期</span>
              </div>
              <div className="flex items-center gap-3 text-sm font-sans font-bold text-brand-ink">
                <CheckCircle2 size={18} className="text-brand-orange" />
                <span>永續森林木材來源</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Cat Academy (SEO Section) */}
      <section id="academy" className="py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center gap-4 mb-12">
            <div className="h-px flex-1 bg-brand-peach"></div>
            <h2 className="text-3xl font-sans font-bold text-center px-6">貓奴小學堂</h2>
            <div className="h-px flex-1 bg-brand-peach"></div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {displayArticles.map((post, idx) => (
              <a 
                key={post.id || idx} 
                href={post.link || "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="p-8 bg-white rounded-brand shadow-sm hover:shadow-md transition-all cursor-pointer group border border-transparent hover:border-brand-peach"
              >
                <span className="text-[10px] font-sans font-bold text-brand-sage uppercase tracking-widest mb-4 block">
                  {post.tag || post.category}
                </span>
                <h4 className="text-lg font-sans font-bold leading-tight group-hover:text-brand-orange transition-colors">
                  {post.title}
                </h4>
                <div className="mt-6 flex items-center text-xs font-sans font-bold text-gray-400 group-hover:text-brand-ink transition-colors">
                  閱讀全文 <ChevronRight size={14} />
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-brand-cream py-20 border-t border-brand-peach">
        <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-4 gap-12">
          <div className="col-span-2">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-8 h-8 bg-brand-orange rounded-brand flex items-center justify-center text-white">
                <Cat size={18} />
              </div>
              <span className="font-sans font-bold text-lg tracking-tight">Mumps Cat Care</span>
            </div>
            <p className="text-gray-500 max-w-sm leading-relaxed mb-8">
              我們致力於提升貓咪的生活品質，透過專業的選品與知識分享，讓每一位貓奴都能與愛貓建立更深的情感連結。
            </p>
            <div className="flex gap-4">
              {['FB', 'IG', 'YT'].map(social => (
                <div key={social} className="w-10 h-10 rounded-brand border border-brand-sage flex items-center justify-center text-brand-sage font-sans font-bold text-xs hover:bg-brand-sage hover:text-white transition-all cursor-pointer">
                  {social}
                </div>
              ))}
            </div>
          </div>

          <div>
            <h5 className="font-sans font-bold mb-6 uppercase tracking-widest text-xs">快速連結</h5>
            <ul className="space-y-4 text-sm text-gray-500 font-sans font-medium">
              <li><a href="#" className="hover:text-brand-orange transition-colors">關於我們</a></li>
              <li><a href="#" className="hover:text-brand-orange transition-colors">配送政策</a></li>
              <li><a href="#" className="hover:text-brand-orange transition-colors">退換貨須知</a></li>
              <li><a href="#" className="hover:text-brand-orange transition-colors">隱私權條款</a></li>
            </ul>
          </div>

          <div>
            <h5 className="font-sans font-bold mb-6 uppercase tracking-widest text-xs">訂閱電子報</h5>
            <p className="text-xs text-gray-500 mb-4">獲取最新的貓咪照護知識與限時優惠。</p>
            <div className="flex gap-2">
              <input 
                type="email" 
                placeholder="你的 Email" 
                className="bg-white border border-brand-peach rounded-brand px-4 py-2 text-sm w-full focus:outline-none focus:border-brand-orange"
              />
              <button className="bg-brand-orange text-white px-4 py-2 rounded-brand font-sans font-bold text-sm">
                訂閱
              </button>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-6 mt-20 pt-8 border-t border-brand-peach flex flex-col md:flex-row justify-between items-center gap-4 text-[10px] font-sans font-bold text-gray-400 uppercase tracking-widest">
          <p>© 2026 Mumps Cat Care. All rights reserved.</p>
          <p>Designed with Love for Cats</p>
        </div>
      </footer>
    </div>
  );
}
