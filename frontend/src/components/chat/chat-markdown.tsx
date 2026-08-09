import { useColorScheme } from "react-native";
import Markdown from "react-native-markdown-display";
import { Colors, Fonts, getTheme } from "@/constants/theme";

interface ChatMarkdownProps {
  content: string;
}

export default function ChatMarkdown({ content }: ChatMarkdownProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[getTheme(colorScheme)];

  const markdownStyles = {
    body: {
      color: colors.text,
      fontFamily: Fonts.sans,
      fontSize: 16,
      lineHeight: 16 * 1.6,
    },
    paragraph: {
      marginTop: 4,
      marginBottom: 4,
      flexWrap: "wrap",
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "flex-start",
      width: "100%",
    },
    strong: {
      fontFamily: Fonts.sansSemiBold,
    },
    em: {
      fontStyle: "italic",
    },
    s: {
      textDecorationLine: "line-through",
    },
    heading1: {
      flexDirection: "row",
      fontFamily: Fonts.serif,
      fontSize: 32,
      lineHeight: 32 * 1.2,
      color: colors.text,
    },
    heading2: {
      flexDirection: "row",
      fontFamily: Fonts.serif,
      fontSize: 24,
      lineHeight: 24 * 1.2,
      color: colors.text,
    },
    heading3: {
      flexDirection: "row",
      fontFamily: Fonts.serif,
      fontSize: 22,
      lineHeight: 22 * 1.6,
      color: colors.text,
    },
    heading4: {
      flexDirection: "row",
      fontFamily: Fonts.serif,
      fontSize: 20,
      lineHeight: 20 * 1.6,
      color: colors.text,
    },
    heading5: {
      flexDirection: "row",
      fontFamily: Fonts.serif,
      fontSize: 18.91,
      lineHeight: 18.91 * 1.6,
      color: colors.text,
    },
    heading6: {
      flexDirection: "row",
      fontFamily: Fonts.serif,
      fontSize: 17.89,
      lineHeight: 17.89 * 1.6,
      color: colors.text,
    },
    code_inline: {
      backgroundColor: colors.neutral[300],
      borderColor: colors.neutral[400],
      borderWidth: 1,
      borderRadius: 4,
      paddingHorizontal: 4,
      paddingVertical: 2,
      fontFamily: "monospace",
      fontSize: 14,
      color: colors.text,
    },
    code_block: {
      backgroundColor: colors.neutral[200],
      borderColor: colors.neutral[400],
      borderWidth: 1,
      borderRadius: 6,
      padding: 10,
      fontFamily: "monospace",
      fontSize: 14,
      color: colors.text,
    },
    fence: {
      backgroundColor: colors.neutral[200],
      borderColor: colors.neutral[400],
      borderWidth: 1,
      borderRadius: 6,
      padding: 10,
      fontFamily: "monospace",
      fontSize: 14,
      color: colors.text,
    },
    link: {
      color: colors.primary[600],
      textDecorationLine: "underline",
    },
    blockquote: {
      backgroundColor: colors.neutral[100],
      borderColor: colors.primary[300],
      borderLeftWidth: 4,
      marginLeft: 4,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 4,
    },
    bullet_list_icon: {
      marginLeft: 4,
      marginRight: 8,
    },
    ordered_list_icon: {
      marginLeft: 4,
      marginRight: 8,
    },
    list_item: {
      flexDirection: "row",
    },
    hr: {
      backgroundColor: colors.neutral[400],
      height: 1,
      marginVertical: 8,
    },
    table: {
      borderWidth: 1,
      borderColor: colors.neutral[400],
      borderRadius: 4,
      marginVertical: 8,
    },
    tr: {
      borderBottomWidth: 1,
      borderColor: colors.neutral[400],
      flexDirection: "row",
    },
    th: {
      flex: 1,
      padding: 6,
      fontFamily: Fonts.sansSemiBold,
    },
    td: {
      flex: 1,
      padding: 6,
    },
  };

  return (
    <Markdown
      mergeStyle
      style={markdownStyles as any}
      onLinkPress={() => true}
    >
      {content}
    </Markdown>
  );
}
