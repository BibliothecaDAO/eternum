const ContentContainer = ({ children }: { children: React.ReactNode }) => {
    return (
        <div className="absolute w-1/4 left-6 bottom-10 h-[calc(100vh-14.5rem)]">
            {children}
        </div>
    );
};

export default ContentContainer;